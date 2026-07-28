import { randomUUID } from "crypto";
import pg from "pg";

const { Pool } = pg;
const intervalMinutes = Math.max(readPositiveInteger(process.env.JOB_SYNC_INTERVAL_MINUTES, 10), 10);
const vacancyMailMaxPages = readPositiveInteger(process.env.VACANCYMAIL_MAX_PAGES, 12);
const jobsZimbabweMaxPages = readPositiveInteger(process.env.JOBSZIMBABWE_MAX_PAGES, 10);
const ngoJobsAfricaMaxPages = readPositiveInteger(process.env.NGOJOBSINAFRICA_MAX_PAGES, 3);
const userAgent = process.env.JOB_SCRAPER_USER_AGENT || "CareerPilotBot/1.0 (+https://careerpilot.co.zw)";
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 4,
});

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is required for job sync.");
}

async function main() {
  await ensureSchema();
  await syncOnce();
  setInterval(() => {
    syncOnce().catch((error) => {
      console.error("job sync failed", error);
    });
  }, intervalMinutes * 60 * 1000);
}

async function syncOnce() {
  for (const sync of [syncVacancyMail, syncJobsZimbabwe, syncNgoJobsInAfrica, syncReliefWebIfConfigured]) {
    await sync().catch((error) => {
      console.error("job source sync failed", error);
    });
  }
  await recordRun({
    source: "vacancybox",
    status: "skipped",
    jobsFound: 0,
    message: "Skipped: VacancyBox page displays a notice against copying site data. Add an approved feed/API before enabling.",
    startedAt: new Date(),
  });
  await recordRun({
    source: "inasi",
    status: "skipped",
    jobsFound: 0,
    message: "Skipped: iNasi terms prohibit scraping/systematic downloads without prior written consent.",
    startedAt: new Date(),
  });
  await recordRun({
    source: "zimbajob",
    status: "skipped",
    jobsFound: 0,
    message: "Skipped: Zimbajob blocks automated access with Cloudflare. Use an approved feed/API before enabling.",
    startedAt: new Date(),
  });
}

async function syncVacancyMail() {
  const startedAt = new Date();
  try {
    const jobs = [];
    for (let page = 1; page <= vacancyMailMaxPages; page += 1) {
      const html = await fetchText(page === 1 ? "https://vacancymail.co.zw/jobs/" : `https://vacancymail.co.zw/jobs/?page=${page}`);
      jobs.push(...parseVacancyMailJobs(html));
      await sleep(1000);
    }

    const uniqueJobs = uniqueJobsBySource(jobs);
    for (const job of uniqueJobs) {
      await upsertJob(job);
    }

    await recordRun({
      source: "vacancymail",
      status: "success",
      jobsFound: uniqueJobs.length,
      message: `Synced ${uniqueJobs.length} listings from VacancyMail.`,
      startedAt,
    });

    console.log(`[jobs] VacancyMail synced ${uniqueJobs.length} listings`);
  } catch (error) {
    await recordRun({
      source: "vacancymail",
      status: "error",
      jobsFound: 0,
      message: error instanceof Error ? error.message.slice(0, 1000) : "Unknown sync error",
      startedAt,
    });
    throw error;
  }
}

async function syncJobsZimbabwe() {
  const startedAt = new Date();
  try {
    const jobs = [];
    for (let page = 1; page <= jobsZimbabweMaxPages; page += 1) {
      const url = page === 1 ? "https://jobszimbabwe.co.zw/jobs/" : `https://jobszimbabwe.co.zw/jobs/page/${page}/`;
      const html = await fetchText(url);
      const pageJobs = parseJobsZimbabweJobs(html);
      jobs.push(...pageJobs);
      if (!pageJobs.length) break;
      await sleep(1000);
    }

    const uniqueJobs = uniqueJobsBySource(jobs);
    for (const job of uniqueJobs) {
      await upsertJob(job);
    }

    await recordRun({
      source: "jobszimbabwe",
      status: "success",
      jobsFound: uniqueJobs.length,
      message: `Synced ${uniqueJobs.length} current listings from JobsZimbabwe.`,
      startedAt,
    });
    console.log(`[jobs] JobsZimbabwe synced ${uniqueJobs.length} listings`);
  } catch (error) {
    await recordRun({
      source: "jobszimbabwe",
      status: "error",
      jobsFound: 0,
      message: error instanceof Error ? error.message.slice(0, 1000) : "Unknown sync error",
      startedAt,
    });
    throw error;
  }
}

async function syncNgoJobsInAfrica() {
  const startedAt = new Date();
  try {
    const jobs = [];
    for (let page = 1; page <= ngoJobsAfricaMaxPages; page += 1) {
      const url = page === 1
        ? "https://ngojobsinafrica.com/search/Zimbabwe/"
        : `https://ngojobsinafrica.com/search/Zimbabwe/page/${page}/`;
      const html = await fetchText(url);
      const pageJobs = parseNgoJobsInAfricaJobs(html);
      jobs.push(...pageJobs);
      await sleep(1000);
    }

    const uniqueJobs = uniqueJobsBySource(jobs);
    for (const job of uniqueJobs) {
      await upsertJob(job);
    }

    await recordRun({
      source: "ngojobsinafrica",
      status: "success",
      jobsFound: uniqueJobs.length,
      message: `Synced ${uniqueJobs.length} Zimbabwe NGO search listings from NGOJobsInAfrica.`,
      startedAt,
    });
    console.log(`[jobs] NGOJobsInAfrica synced ${uniqueJobs.length} listings`);
  } catch (error) {
    await recordRun({
      source: "ngojobsinafrica",
      status: "error",
      jobsFound: 0,
      message: error instanceof Error ? error.message.slice(0, 1000) : "Unknown sync error",
      startedAt,
    });
    throw error;
  }
}

async function syncReliefWebIfConfigured() {
  const startedAt = new Date();
  const appName = process.env.RELIEFWEB_APP_NAME || "";
  if (!appName) {
    await recordRun({
      source: "reliefweb",
      status: "skipped",
      jobsFound: 0,
      message: "Skipped: ReliefWeb API requires an approved appname. Set RELIEFWEB_APP_NAME after approval.",
      startedAt,
    });
    return;
  }

  try {
    const url = `https://api.reliefweb.int/v2/jobs?appname=${encodeURIComponent(appName)}&profile=list&preset=latest&slim=1&limit=50&filter[field]=country&filter[value]=Zimbabwe`;
    const payload = JSON.parse(await fetchText(url, "application/json"));
    const jobs = Array.isArray(payload.data)
      ? payload.data.map((item) => reliefWebJob(item)).filter(Boolean)
      : [];

    for (const job of jobs) {
      await upsertJob(job);
    }

    await recordRun({
      source: "reliefweb",
      status: "success",
      jobsFound: jobs.length,
      message: `Synced ${jobs.length} Zimbabwe listings from ReliefWeb API.`,
      startedAt,
    });
    console.log(`[jobs] ReliefWeb synced ${jobs.length} listings`);
  } catch (error) {
    await recordRun({
      source: "reliefweb",
      status: "error",
      jobsFound: 0,
      message: error instanceof Error ? error.message.slice(0, 1000) : "Unknown sync error",
      startedAt,
    });
    throw error;
  }
}

function parseVacancyMailJobs(html) {
  const jobs = [];
  const blocks = html.match(/<a\b[^>]*class="job-listing"[\s\S]*?<\/a>/g) || [];

  for (const block of blocks) {
    const href = attr(block, "href");
    const url = href.startsWith("http") ? href : `https://vacancymail.co.zw${href}`;
    const title = text(match(block, /<h3\b[^>]*class="job-listing-title"[^>]*>([\s\S]*?)<\/h3>/i));
    const company = text(match(block, /<h4\b[^>]*class="job-listing-company"[^>]*>([\s\S]*?)<\/h4>/i));
    const summary = text(match(block, /<p\b[^>]*class="job-listing-text"[^>]*>([\s\S]*?)<\/p>/i));
    const footer = [...block.matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/gi)].map((item) => text(item[1]));
    const location = footer.find((item) => !/^expires\b/i.test(item) && !/^posted\b/i.test(item) && !jobTypeLooksLike(item) && !salaryLooksLike(item)) || "";
    const expiresText = footer.find((item) => /^expires\b/i.test(item)) || "";
    const postedText = footer.find((item) => /^posted\b/i.test(item)) || "";
    const jobType = footer.find(jobTypeLooksLike) || "";
    const salary = footer.find(salaryLooksLike) || "";

    if (!href || !title) continue;

    jobs.push({
      id: randomUUID(),
      source: "vacancymail",
      externalId: href.replace(/^\/+|\/+$/g, ""),
      title,
      company,
      location,
      jobType,
      salary,
      expiresText,
      postedText,
      summary,
      description: summary,
      url,
      raw: { footer },
    });
  }

  return jobs;
}

function parseJobsZimbabweJobs(html) {
  const jobs = [];
  const blocks = html.match(/<article\b[^>]*class="[^"]*noo_job[^"]*"[\s\S]*?<\/article>/g) || [];

  for (const block of blocks) {
    if (/\bclosed-job\b/.test(block)) continue;

    const url = attr(block, "data-url") || attr(match(block, /<h3\b[^>]*class="loop-item-title"[\s\S]*?(<a\b[\s\S]*?<\/a>)/i), "href");
    const title = text(match(block, /<h3\b[^>]*class="loop-item-title"[\s\S]*?<a\b[^>]*>([\s\S]*?)<\/a>/i));
    const jobType = text(match(block, /<span\b[^>]*class="job-type"[\s\S]*?<span>([\s\S]*?)<\/span>/i));
    const location = text(match(block, /<span\b[^>]*class="job-location"[\s\S]*?<\/span>/i)).replace(/\s*,\s*/g, ", ");
    const expiresText = text(match(block, /<span\b[^>]*class="job-date__closing"[^>]*>([\s\S]*?)<\/span>/i));
    const postedText = text(match(block, /<time\b[^>]*datetime="([^"]+)"/i));
    const category = text(match(block, /<span\b[^>]*class="job-category"[\s\S]*?<\/span>/i));
    const company = companyFromJobsZimbabweTitle(title);

    if (!url || !title || isExpired(expiresText)) continue;

    jobs.push({
      id: randomUUID(),
      source: "jobszimbabwe",
      externalId: url.replace(/^https?:\/\/(www\.)?jobszimbabwe\.co\.zw\/jobs\/|\/$/gi, ""),
      title,
      company,
      location,
      jobType,
      salary: "",
      expiresText: expiresText ? `Closes ${expiresText}` : "",
      postedText: postedText ? `Posted ${postedText.slice(0, 10)}` : "",
      summary: category,
      description: category,
      url,
      raw: { category },
    });
  }

  return jobs;
}

function parseNgoJobsInAfricaJobs(html) {
  const jobs = [];
  const blocks = html.match(/<article\b[^>]*class="result"[\s\S]*?<\/article>/g) || [];

  for (const block of blocks) {
    const anchor = match(block, /<h2\b[\s\S]*?(<a\b[\s\S]*?<\/a>)/i);
    const url = attr(anchor, "href");
    if (!/\/job\//.test(url)) continue;

    const title = text(match(anchor, /<a\b[^>]*>([\s\S]*?)<\/a>/i));
    const summary = text(match(block, /<p\b[^>]*>([\s\S]*?)<\/p>/i));
    if (!url || !title) continue;

    jobs.push({
      id: randomUUID(),
      source: "ngojobsinafrica",
      externalId: url.replace(/^https?:\/\/(www\.)?ngojobsinafrica\.com\/job\/|\/$/gi, ""),
      title,
      company: "",
      location: "Zimbabwe",
      jobType: "NGO",
      salary: "",
      expiresText: "",
      postedText: "",
      summary,
      description: summary,
      url,
      raw: {},
    });
  }

  return jobs;
}

function reliefWebJob(item) {
  const fields = item?.fields;
  if (!fields?.title || !fields?.url) return null;
  const source = Array.isArray(fields.source) ? fields.source[0]?.name : fields.source?.name;
  const country = Array.isArray(fields.country) ? fields.country.map((entry) => entry.name).join(", ") : "Zimbabwe";
  const deadline = fields.date?.closing || "";
  if (deadline && new Date(deadline).getTime() < Date.now()) return null;

  return {
    id: randomUUID(),
    source: "reliefweb",
    externalId: String(item.id || fields.url),
    title: fields.title,
    company: source || "",
    location: country || "Zimbabwe",
    jobType: Array.isArray(fields.type) ? fields.type.map((entry) => entry.name).join(", ") : "",
    salary: "",
    expiresText: deadline ? `Closes ${deadline.slice(0, 10)}` : "",
    postedText: fields.date?.created ? `Posted ${fields.date.created.slice(0, 10)}` : "",
    summary: fields.body ? text(fields.body).slice(0, 700) : "",
    description: fields.body ? text(fields.body).slice(0, 2000) : "",
    url: fields.url,
    raw: {},
  };
}

async function upsertJob(job) {
  await pool.query(
    `insert into job_listings (
      id, source, external_id, title, company, location, job_type, salary,
      expires_text, posted_text, summary, description, url, raw, discovered_at, updated_at
    ) values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, now(), now())
    on conflict (source, external_id)
    do update set
      title = excluded.title,
      company = excluded.company,
      location = excluded.location,
      job_type = excluded.job_type,
      salary = excluded.salary,
      expires_text = excluded.expires_text,
      posted_text = excluded.posted_text,
      summary = excluded.summary,
      description = excluded.description,
      url = excluded.url,
      raw = excluded.raw,
      updated_at = now()`,
    [
      job.id,
      job.source,
      job.externalId,
      job.title,
      job.company,
      job.location,
      job.jobType,
      job.salary,
      job.expiresText,
      job.postedText,
      job.summary,
      job.description,
      job.url,
      job.raw,
    ],
  );
}

async function recordRun({ source, status, jobsFound, message, startedAt }) {
  await pool.query(
    `insert into job_sync_runs (id, source, status, jobs_found, message, started_at, finished_at)
     values ($1, $2, $3, $4, $5, $6, now())`,
    [randomUUID(), source, status, jobsFound, message, startedAt],
  );
}

async function ensureSchema() {
  await pool.query(`
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
  `);
}

async function fetchText(url, accept = "text/html,application/xhtml+xml,application/rss+xml") {
  const response = await fetch(url, {
    headers: {
      "User-Agent": userAgent,
      "Accept": accept,
    },
  });

  if (!response.ok) {
    throw new Error(`Fetch failed for ${url}: ${response.status}`);
  }
  return response.text();
}

function match(value, pattern) {
  return value.match(pattern)?.[1] || "";
}

function attr(value, name) {
  return value.match(new RegExp(`${name}=["']([^"']+)["']`, "i"))?.[1] || "";
}

function text(value) {
  return decodeHtml(value.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim());
}

function decodeHtml(value) {
  return value
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&hellip;/g, "...")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCharCode(parseInt(code, 16)));
}

function jobTypeLooksLike(value) {
  return /^(full time|part time|internship|contractor|contract|temporary|graduate trainee)$/i.test(value.trim());
}

function salaryLooksLike(value) {
  return /^(tba|usd|\$|\d)/i.test(value.trim()) && !/^posted/i.test(value) && !/^expires/i.test(value);
}

function companyFromJobsZimbabweTitle(title) {
  const parts = title.split(/\s+[–-]\s+/).map((part) => part.trim()).filter(Boolean);
  return parts.length > 1 ? parts.at(-1) || "" : "";
}

function isExpired(expiresText) {
  if (!expiresText) return false;
  const cleaned = expiresText.replace(/^(closes|expires)\s+/i, "").trim();
  const parsed = Date.parse(cleaned);
  if (Number.isNaN(parsed)) return false;
  const endOfDay = new Date(parsed);
  endOfDay.setHours(23, 59, 59, 999);
  return endOfDay.getTime() < Date.now();
}

function uniqueJobsBySource(jobs) {
  const seen = new Set();
  return jobs.filter((job) => {
    const key = `${job.source}:${job.externalId}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function readPositiveInteger(value, fallback) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 1) return fallback;
  return Math.floor(parsed);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
