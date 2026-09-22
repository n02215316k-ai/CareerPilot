import { Pool, type QueryResultRow } from "pg";
import { randomUUID } from "crypto";
import { emptyProfile, normalizeCvDocument, normalizeProfile } from "./profile";
import { recommendJobsFromProfile } from "./job-recommendations";
import type { CareerProfile, CvDocument, GeneratedCvRecord, JobListing, JobRecommendation, JobSyncRun } from "./types";

type QueryValue = string | number | boolean | null | Date | Record<string, unknown> | unknown[];

const globalForDb = globalThis as unknown as {
  careerPilotPool?: Pool;
  careerPilotSchema?: Promise<void>;
};

function pool() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is not configured.");
  }

  globalForDb.careerPilotPool ??= new Pool({
    connectionString: process.env.DATABASE_URL,
    max: Number(process.env.DATABASE_POOL_MAX || 8),
  });

  return globalForDb.careerPilotPool;
}

async function ensureSchema() {
  globalForDb.careerPilotSchema ??= pool().query(`
    create table if not exists users (
      id text primary key,
      email text not null unique,
      password_hash text not null,
      created_at timestamptz not null default now()
    );

    create table if not exists career_profiles (
      user_id text primary key references users(id) on delete cascade,
      data jsonb not null default '{}'::jsonb,
      updated_at timestamptz not null default now()
    );

    create table if not exists uploaded_documents (
      id text primary key,
      user_id text not null references users(id) on delete cascade,
      filename text not null,
      text_content text not null,
      created_at timestamptz not null default now()
    );

    create table if not exists generated_cvs (
      id text primary key,
      user_id text not null references users(id) on delete cascade,
      title text not null,
      job_title text not null,
      template text not null,
      job_description text not null,
      content jsonb not null,
      created_at timestamptz not null default now()
    );

    create table if not exists ai_requests (
      id text primary key,
      user_id text references users(id) on delete set null,
      feature text not null,
      model text not null,
      success boolean not null,
      error text,
      created_at timestamptz not null default now()
    );

    create table if not exists job_listings (
      id text primary key,
      source text not null,
      external_id text not null,
      title text not null,
      company text not null default '',
      location text not null default '',
      job_type text not null default '',
      salary text not null default '',
      expires_text text not null default '',
      posted_text text not null default '',
      summary text not null default '',
      description text not null default '',
      url text not null,
      discovered_at timestamptz not null default now(),
      updated_at timestamptz not null default now(),
      raw jsonb not null default '{}'::jsonb,
      unique (source, external_id)
    );

    create index if not exists job_listings_updated_at_idx on job_listings (updated_at desc);
    create index if not exists job_listings_source_idx on job_listings (source);

    create table if not exists job_sync_runs (
      id text primary key,
      source text not null,
      status text not null,
      jobs_found integer not null default 0,
      message text not null default '',
      started_at timestamptz not null default now(),
      finished_at timestamptz not null default now()
    );

    create index if not exists job_sync_runs_source_finished_idx on job_sync_runs (source, finished_at desc);

    create table if not exists page_view_counters (
      page_key text primary key,
      view_count bigint not null default 0,
      updated_at timestamptz not null default now()
    );
  `).then(() => undefined);

  return globalForDb.careerPilotSchema;
}

export async function query<T extends QueryResultRow>(text: string, values: QueryValue[] = []) {
  await ensureSchema();
  return pool().query<T>(text, values);
}

export async function incrementPageViews(pageKey: string): Promise<number> {
  const result = await query<{ view_count: string }>(
    `insert into page_view_counters (page_key, view_count)
     values ($1, 1)
     on conflict (page_key) do update
     set view_count = page_view_counters.view_count + 1, updated_at = now()
     returning view_count`,
    [pageKey],
  );
  return Number(result.rows[0]?.view_count || 0);
}

export async function getPageViews(pageKey: string): Promise<number> {
  const result = await query<{ view_count: string }>(
    "select view_count from page_view_counters where page_key = $1",
    [pageKey],
  );
  return Number(result.rows[0]?.view_count || 0);
}

export async function createUser(email: string, passwordHash: string) {
  const id = randomUUID();
  await query("insert into users (id, email, password_hash) values ($1, $2, $3)", [
    id,
    email.toLowerCase(),
    passwordHash,
  ]);
  await saveProfile(id, emptyProfile);
  return { id, email: email.toLowerCase() };
}

export async function findUserByEmail(email: string) {
  const result = await query<{ id: string; email: string; password_hash: string }>(
    "select id, email, password_hash from users where email = $1",
    [email.toLowerCase()],
  );
  return result.rows[0] ?? null;
}

export async function getProfile(userId: string): Promise<CareerProfile> {
  const result = await query<{ data: unknown }>("select data from career_profiles where user_id = $1", [userId]);
  if (!result.rows[0]) {
    await saveProfile(userId, emptyProfile);
    return emptyProfile;
  }
  return normalizeProfile(result.rows[0].data);
}

export async function saveProfile(userId: string, profile: CareerProfile) {
  await query(
    `insert into career_profiles (user_id, data, updated_at)
     values ($1, $2, now())
     on conflict (user_id)
     do update set data = excluded.data, updated_at = now()`,
    [userId, profile],
  );
}

export async function saveUploadedDocument(userId: string, filename: string, textContent: string) {
  await query(
    "insert into uploaded_documents (id, user_id, filename, text_content) values ($1, $2, $3, $4)",
    [randomUUID(), userId, filename, textContent],
  );
}

export async function saveGeneratedCv(
  userId: string,
  title: string,
  jobTitle: string,
  template: string,
  jobDescription: string,
  content: CvDocument,
) {
  const id = randomUUID();
  await query(
    `insert into generated_cvs (id, user_id, title, job_title, template, job_description, content)
     values ($1, $2, $3, $4, $5, $6, $7)`,
    [id, userId, title, jobTitle, template, jobDescription, content],
  );
  return id;
}

export async function listGeneratedCvs(userId: string): Promise<GeneratedCvRecord[]> {
  const result = await query<{
    id: string;
    title: string;
    job_title: string;
    template: string;
    content: CvDocument;
    created_at: Date;
  }>(
    `select id, title, job_title, template, content, created_at
     from generated_cvs
     where user_id = $1
     order by created_at desc
     limit 30`,
    [userId],
  );

  return result.rows.map((row) => ({
    id: row.id,
    title: row.title,
    jobTitle: row.job_title,
    template: row.template,
    content: normalizeCvDocument(row.content),
    createdAt: row.created_at.toISOString(),
  }));
}

export async function updateGeneratedCv(userId: string, id: string, title: string, content: CvDocument) {
  const result = await query<{ id: string }>(
    `update generated_cvs
     set title = $3, content = $4
     where id = $1 and user_id = $2
     returning id`,
    [id, userId, title, content],
  );
  return Boolean(result.rows[0]);
}

export async function logAiRequest(userId: string | null, feature: string, model: string, success: boolean, error?: string) {
  await query(
    "insert into ai_requests (id, user_id, feature, model, success, error) values ($1, $2, $3, $4, $5, $6)",
    [randomUUID(), userId, feature, model, success, error || null],
  );
}

export async function listJobs(options: { search?: string; source?: string; location?: string; limit?: number } = {}): Promise<JobListing[]> {
  const clauses: string[] = [];
  const values: QueryValue[] = [];

  if (options.search) {
    values.push(`%${options.search}%`);
    clauses.push(`(title ilike $${values.length} or company ilike $${values.length} or summary ilike $${values.length} or description ilike $${values.length})`);
  }

  if (options.source && options.source !== "all") {
    values.push(options.source);
    clauses.push(`source = $${values.length}`);
  }

  if (options.location) {
    values.push(`%${options.location}%`);
    clauses.push(`location ilike $${values.length}`);
  }

  values.push(Math.min(Math.max(options.limit || 80, 1), 150));

  const result = await query<JobListingRow>(
    `select *
     from job_listings
     ${clauses.length ? `where ${clauses.join(" and ")}` : ""}
     order by updated_at desc
     limit $${values.length}`,
    values,
  );

  return result.rows.map(mapJobRow).filter(isCurrentJob);
}

export async function listRecommendedJobs(userId: string): Promise<JobRecommendation[]> {
  const profile = await getProfile(userId);
  const jobs = await listJobs({ limit: 150 });
  return recommendJobsFromProfile(profile, jobs).slice(0, 40);
}

export async function listJobSyncRuns(): Promise<JobSyncRun[]> {
  const result = await query<JobSyncRunRow>(
    `select distinct on (source) *
     from job_sync_runs
     order by source, finished_at desc`,
  );
  return result.rows.map((row) => ({
    id: row.id,
    source: row.source,
    status: row.status,
    jobsFound: row.jobs_found,
    message: row.message,
    startedAt: row.started_at.toISOString(),
    finishedAt: row.finished_at.toISOString(),
  }));
}

type JobListingRow = {
  id: string;
  source: string;
  title: string;
  company: string;
  location: string;
  job_type: string;
  salary: string;
  expires_text: string;
  posted_text: string;
  summary: string;
  description: string;
  url: string;
  discovered_at: Date;
  updated_at: Date;
};

type JobSyncRunRow = {
  id: string;
  source: string;
  status: string;
  jobs_found: number;
  message: string;
  started_at: Date;
  finished_at: Date;
};

function mapJobRow(row: JobListingRow): JobListing {
  return {
    id: row.id,
    source: row.source,
    title: row.title,
    company: row.company,
    location: row.location,
    jobType: row.job_type,
    salary: row.salary,
    expiresText: row.expires_text,
    postedText: row.posted_text,
    summary: row.summary,
    description: row.description,
    url: row.url,
    discoveredAt: row.discovered_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

function isCurrentJob(job: JobListing) {
  const text = job.expiresText.replace(/^(expires|closes)\s+/i, "").trim();
  if (!text) return true;
  const parsed = Date.parse(text);
  if (Number.isNaN(parsed)) return true;
  const endOfDay = new Date(parsed);
  endOfDay.setHours(23, 59, 59, 999);
  return endOfDay.getTime() >= Date.now();
}
