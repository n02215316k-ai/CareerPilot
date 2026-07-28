import { Pool, type QueryResultRow } from "pg";
import { randomUUID } from "crypto";
import { emptyProfile, normalizeProfile } from "./profile";
import type { CareerProfile, CvDocument, GeneratedCvRecord } from "./types";

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
  `).then(() => undefined);

  return globalForDb.careerPilotSchema;
}

export async function query<T extends QueryResultRow>(text: string, values: QueryValue[] = []) {
  await ensureSchema();
  return pool().query<T>(text, values);
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
    content: row.content,
    createdAt: row.created_at.toISOString(),
  }));
}

export async function logAiRequest(userId: string | null, feature: string, model: string, success: boolean, error?: string) {
  await query(
    "insert into ai_requests (id, user_id, feature, model, success, error) values ($1, $2, $3, $4, $5, $6)",
    [randomUUID(), userId, feature, model, success, error || null],
  );
}
