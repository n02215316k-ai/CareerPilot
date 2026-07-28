import type { CareerProfile, JobListing, JobRecommendation } from "./types";

const stopWords = new Set([
  "and",
  "the",
  "for",
  "with",
  "from",
  "this",
  "that",
  "role",
  "job",
  "full",
  "time",
  "part",
  "contract",
  "internship",
]);

export function recommendJobsFromProfile(profile: CareerProfile, jobs: JobListing[]): JobRecommendation[] {
  const profileKeywords = buildProfileKeywords(profile);
  const targetRoles = normalizeTerms(profile.targetRoles);
  const locations = normalizeTerms([profile.personalDetails.location]);

  return jobs
    .map((job) => scoreJob(job, profileKeywords, targetRoles, locations))
    .sort((a, b) => b.score - a.score || new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
}

function scoreJob(
  job: JobListing,
  profileKeywords: string[],
  targetRoles: string[],
  locations: string[],
): JobRecommendation {
  const haystack = normalizeText([
    job.title,
    job.company,
    job.location,
    job.jobType,
    job.summary,
    job.description,
  ].join(" "));
  const title = normalizeText(job.title);
  const matchedKeywords: string[] = [];
  const reasons: string[] = [];
  let score = 0;

  for (const role of targetRoles) {
    if (role.length < 3) continue;
    if (title.includes(role)) {
      score += 35;
      matchedKeywords.push(role);
      reasons.push(`Title matches target role: ${role}`);
    } else if (haystack.includes(role)) {
      score += 16;
      matchedKeywords.push(role);
      reasons.push(`Description mentions target role: ${role}`);
    }
  }

  for (const keyword of profileKeywords) {
    if (keyword.length < 3) continue;
    if (title.includes(keyword)) {
      score += 18;
      matchedKeywords.push(keyword);
    } else if (haystack.includes(keyword)) {
      score += 8;
      matchedKeywords.push(keyword);
    }
  }

  for (const location of locations) {
    if (location.length >= 3 && normalizeText(job.location).includes(location)) {
      score += 6;
      reasons.push(`Location match: ${job.location}`);
    }
  }

  const uniqueMatches = unique(matchedKeywords).slice(0, 12);
  if (uniqueMatches.length) {
    reasons.unshift(`Matched ${uniqueMatches.length} profile keyword${uniqueMatches.length === 1 ? "" : "s"}`);
  }
  if (!reasons.length) {
    reasons.push("Recent listing; add more skills and target roles to improve recommendations.");
  }

  return {
    ...job,
    score,
    matchedKeywords: uniqueMatches,
    reasons: unique(reasons).slice(0, 4),
  };
}

function buildProfileKeywords(profile: CareerProfile) {
  return unique(normalizeTerms([
    ...profile.skills.technical,
    ...profile.skills.tools,
    ...profile.skills.soft,
    ...profile.skills.languages,
    ...profile.projects.flatMap((project) => [project.name, project.role, ...project.technologies]),
    ...profile.experience.flatMap((item) => [item.role, ...item.bullets]),
    ...profile.education.flatMap((item) => [item.field, item.qualification]),
    ...profile.volunteering,
  ])).slice(0, 80);
}

function normalizeTerms(values: string[]) {
  return values
    .flatMap((value) => normalizeText(value).split(/[,|/;]+|\s+-\s+/))
    .map((value) => value.trim())
    .filter((value) => value.length >= 3 && !stopWords.has(value));
}

function normalizeText(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9+#.\s-]/g, " ").replace(/\s+/g, " ").trim();
}

function unique(values: string[]) {
  const seen = new Set<string>();
  return values.filter((value) => {
    const key = value.trim().toLowerCase();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
