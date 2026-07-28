import { emptyProfile, normalizeProfile, unique } from "./profile";
import type { CareerProfile, CertificationItem, EducationItem, ExperienceItem, ProjectItem } from "./types";

type SectionKey = "header" | "summary" | "skills" | "experience" | "education" | "projects" | "certifications" | "references";
type Sections = Record<SectionKey, string[]>;

const monthOrYear = /(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec|january|february|march|april|june|july|august|september|october|november|december|\d{4}|present|current)/i;
const dateSeparator = /\s*(?:\u2013|\u2014)\s*|\s+-\s+|\s+to\s+/i;
const titleSeparator = /\s*(?:\u2013|\u2014)\s*|\s+-\s+/;
const bulletPrefix = /^[\u2022\u00b7\-\u2013\u2014]\s*/;

export function parseCvText(text: string): CareerProfile {
  const lines = cleanLines(text);
  const repairedText = lines.join("\n");
  const sections = splitSections(lines);
  const header = parseHeader(sections.header, repairedText);
  const experience = parseExperience(sections.experience);
  const volunteering = parseVolunteering(experience, sections);

  return normalizeProfile({
    ...emptyProfile,
    personalDetails: header.personalDetails,
    targetRoles: header.targetRoles,
    professionalSummary: sectionParagraph(sections.summary),
    education: parseEducation(sections.education),
    experience,
    projects: parseProjects(sections.projects),
    volunteering,
    skills: parseSkills(sections.skills),
    certifications: parseCertifications(sections.certifications),
    references: sectionParagraph(sections.references),
  });
}

export function mergeExtractedProfiles(primary: CareerProfile, fallback: CareerProfile): CareerProfile {
  const primaryCertifications = expandCertificationItems(primary.certifications);
  const fallbackCertifications = expandCertificationItems(fallback.certifications);

  return normalizeProfile({
    personalDetails: {
      fullName: chooseClean(primary.personalDetails.fullName, fallback.personalDetails.fullName, true),
      email: chooseClean(primary.personalDetails.email, fallback.personalDetails.email),
      phone: chooseClean(primary.personalDetails.phone, fallback.personalDetails.phone),
      location: chooseClean(primary.personalDetails.location, fallback.personalDetails.location),
      linkedin: chooseClean(primary.personalDetails.linkedin, fallback.personalDetails.linkedin),
      portfolio: chooseClean(primary.personalDetails.portfolio, fallback.personalDetails.portfolio),
    },
    targetRoles: unique([...primary.targetRoles.map(formatAllCapsPhrase), ...fallback.targetRoles.map(formatAllCapsPhrase)]),
    professionalSummary: chooseClean(primary.professionalSummary, fallback.professionalSummary),
    education: mergeByKey(primary.education, fallback.education, educationKey),
    experience: mergeByKey(primary.experience, fallback.experience, (item) => [item.role, item.company, item.startDate].join("|")),
    projects: mergeProjectItems(primary.projects, fallback.projects),
    volunteering: unique([...primary.volunteering, ...fallback.volunteering]),
    skills: {
      technical: unique([...primary.skills.technical, ...fallback.skills.technical]),
      tools: unique([...primary.skills.tools, ...fallback.skills.tools]),
      soft: unique([...primary.skills.soft, ...fallback.skills.soft]),
      languages: unique([...primary.skills.languages, ...fallback.skills.languages]),
    },
    certifications: mergeByKey(primaryCertifications, fallbackCertifications, certificationKey),
    achievements: unique([...primary.achievements, ...fallback.achievements]),
    references: chooseClean(primary.references, fallback.references),
  });
}

export function extractionMissingInformation(profile: CareerProfile) {
  const missing: string[] = [];
  if (!profile.personalDetails.fullName) missing.push("Full name");
  if (!profile.personalDetails.email && !profile.personalDetails.phone) missing.push("Email or phone number");
  if (!profile.personalDetails.location) missing.push("Location");
  if (!profile.targetRoles.length) missing.push("Target role");
  if (!profile.professionalSummary) missing.push("Professional summary");
  if (!profile.education.length) missing.push("Education");
  if (!profile.experience.length) missing.push("Experience");
  if (!profile.skills.technical.length && !profile.skills.tools.length) missing.push("Technical skills");
  if (!profile.references) missing.push("References");
  return missing;
}

export function repairExtractedProfile(profile: CareerProfile): CareerProfile {
  const repaired = repairValue(profile) as CareerProfile;
  return normalizeProfile({
    ...repaired,
    personalDetails: {
      ...repaired.personalDetails,
      fullName: formatAllCapsPhrase(repaired.personalDetails.fullName),
    },
    targetRoles: repaired.targetRoles.map(formatAllCapsPhrase),
    experience: repaired.experience.map((item) => ({
      ...item,
      role: formatAllCapsPhrase(item.role),
    })),
  });
}

function cleanLines(text: string) {
  return repairEncoding(text)
    .replace(/\u00a0/g, " ")
    .replace(/\r/g, "\n")
    .split("\n")
    .map((line) => repairString(line))
    .filter(Boolean);
}

function splitSections(lines: string[]) {
  const sections: Sections = {
    header: [],
    summary: [],
    skills: [],
    experience: [],
    education: [],
    projects: [],
    certifications: [],
    references: [],
  };
  let current: SectionKey = "header";

  for (const line of lines) {
    const heading = sectionForHeading(line);
    if (heading) {
      current = heading;
      continue;
    }
    sections[current].push(line);
  }

  return sections;
}

function sectionForHeading(line: string): SectionKey | null {
  const normalized = line.replace(/[^a-z0-9& ]/gi, "").replace(/\s+/g, " ").trim().toUpperCase();
  if (/^(PROFESSIONAL|CAREER|PERSONAL) SUMMARY$/.test(normalized)) return "summary";
  if (/^(TECHNICAL )?SKILLS$/.test(normalized)) return "skills";
  if (/^(PROFESSIONAL|WORK|EMPLOYMENT) EXPERIENCE$/.test(normalized)) return "experience";
  if (normalized === "EDUCATION") return "education";
  if (/^(SELECTED )?(AI )?PROJECTS?$/.test(normalized)) return "projects";
  if (/^CERTIFICATIONS?/.test(normalized)) return "certifications";
  if (normalized === "REFERENCES") return "references";
  return null;
}

function parseHeader(lines: string[], text: string) {
  const email = text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0] || "";
  const phone = text.match(/(?:\+?\d[\d\s()./-]{7,}\d)/)?.[0]?.replace(/\s+/g, " ").trim() || "";
  const name = formatAllCapsPhrase(lines.find((line) => !line.includes("@") && !monthOrYear.test(line)) || "");
  const roleLine = lines.find((line) => /\b(engineer|scientist|developer|analyst|manager|intern|officer|administrator|consultant)\b/i.test(line)) || "";
  const targetRoles = roleLine
    .split("|")
    .map((role) => formatAllCapsPhrase(role))
    .filter((role) => role && !role.includes("@") && !/\bZimbabwe\b/i.test(role));
  const contactLine = lines.find((line) => line.includes("@") || /\+?\d[\d\s()./-]{7,}\d/.test(line)) || "";
  const location = contactLine
    .split("|")
    .map((part) => part.trim())
    .find((part) => part && !part.includes("@") && !/\d/.test(part) && !/^female|male|dob/i.test(part)) || "";

  return {
    personalDetails: {
      fullName: name,
      email,
      phone,
      location,
      linkedin: linkFor(text, /linkedin\.com\/\S+/i),
      portfolio: linkFor(text, /(?:https?:\/\/)?(?:www\.)?(?:github|behance|portfolio|vercel|netlify)[a-z0-9.-]*(?:\/\S*)?/i, email),
    },
    targetRoles,
  };
}

function parseSkills(lines: string[]) {
  const skills = {
    technical: [] as string[],
    tools: [] as string[],
    soft: [] as string[],
    languages: [] as string[],
  };
  let bucket: keyof typeof skills = "technical";

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const category = line.toLowerCase();
    const nextCategory = (lines[index + 1] || "").toLowerCase();

    if (/analytics tools|tools|software/.test(category) && /supporting skills|soft skills|personal skills/.test(nextCategory)) {
      if (lines[index + 2]) skills.tools.push(...splitList(lines[index + 2]));
      if (lines[index + 3]) skills.soft.push(...splitList(lines[index + 3]));
      index += 3;
      continue;
    }

    if (/analytics tools|tools|software/.test(category)) {
      bucket = "tools";
      continue;
    }
    if (/supporting skills|soft skills|personal skills/.test(category)) {
      bucket = "soft";
      continue;
    }
    if ((/^languages?$/.test(category) || /language skills/.test(category)) && !/programming/.test(category)) {
      bucket = "languages";
      continue;
    }
    if (/programming|ai|data science|data & systems|testing|governance|technical/.test(category) && line.length < 60) {
      bucket = "technical";
      continue;
    }

    skills[bucket].push(...splitList(line));
  }

  return {
    technical: unique(skills.technical),
    tools: unique(skills.tools),
    soft: unique(skills.soft),
    languages: unique(skills.languages),
  };
}

function parseExperience(lines: string[]): ExperienceItem[] {
  const items: ExperienceItem[] = [];
  for (let index = 0; index < lines.length; index += 1) {
    const line = stripBullet(lines[index]);
    const next = lines[index + 1] || "";
    if (!isRoleLine(line, next)) continue;

    const { role, company } = parseRoleCompany(line);
    const dateLine = monthOrYear.test(next) ? normalizeDateLine(next) : "";
    if (dateLine) index += 1;

    const bullets: string[] = [];
    while (index + 1 < lines.length && !isRoleLine(stripBullet(lines[index + 1]), lines[index + 2] || "")) {
      index += 1;
      const bullet = stripBullet(lines[index]);
      if (bullet && (!monthOrYear.test(bullet) || !dateLine)) bullets.push(bullet);
    }

    items.push({
      company,
      role,
      location: "",
      startDate: splitDates(dateLine).startDate,
      endDate: splitDates(dateLine).endDate,
      bullets: unique(bullets),
    });
  }
  return items;
}

function parseEducation(lines: string[]): EducationItem[] {
  const items: EducationItem[] = [];
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (/^relevant modules/i.test(line) && items.length) {
      items[items.length - 1].details = line;
      continue;
    }

    if (/bachelor|degree|diploma|certificate|zimsec|ordinary level|advanced level/i.test(line)) {
      const parts = line.split("|").map((part) => part.trim()).filter(Boolean);
      const dates = parts.find((part) => /\d{4}/.test(part)) || "";
      const institution = parts.find((part) => !/\d{4}/.test(part) && /university|college|school|nust|zimsec/i.test(part)) || (/zimsec/i.test(line) ? "ZIMSEC" : "");
      const qualification = parts[0] || line;
      const field = qualification.match(/\bin\s+(.+)$/i)?.[1] || "";
      const next = lines[index + 1] || "";

      items.push({
        institution,
        qualification: (field ? qualification.replace(/\s+in\s+.+$/i, "").trim() : qualification) || qualification,
        field,
        startDate: splitDates(dates).startDate,
        endDate: splitDates(dates).endDate,
        details: /^relevant modules/i.test(next) ? next : "",
      });
    }
  }
  return items;
}

function parseProjects(lines: string[]): ProjectItem[] {
  if (!lines.length) return [];
  const first = lines[0] || "";
  const [name = first, role = ""] = first.split("|").map((part) => part.trim());
  const details = lines.slice(1).filter((line) => !/^NUST$/i.test(line)).map(stripBullet);
  const outcome = details.find((line) => /\b(achiev|accuracy|completed|delivered|improved)\b/i.test(line)) || "";

  return [{
    name,
    role,
    technologies: inferTechnologies(details.join(" ")),
    description: details.filter((line) => line !== outcome).join(" "),
    outcome,
  }];
}

function parseCertifications(lines: string[]): CertificationItem[] {
  return lines
    .map(stripBullet)
    .filter(Boolean)
    .flatMap((line) => expandCertificationItem(certificationFromLine(line)))
    .filter((item) => item.name);
}

function parseVolunteering(experience: ExperienceItem[], sections: Sections) {
  const explicit = [...sections.header, ...sections.experience, ...sections.projects]
    .filter((line) => /\b(volunteer|community|charit|church|school activities|girls code|inclusion)\b/i.test(line))
    .map(stripBullet);
  const fromExperience = experience
    .filter((item) => /\b(volunteer|community|girls code|code club|charit|church)\b/i.test([item.role, item.company, ...item.bullets].join(" ")))
    .map((item) => [item.role, item.company, [item.startDate, item.endDate].filter(Boolean).join(" - ")].filter(Boolean).join(", "));
  return unique([...fromExperience, ...explicit]).slice(0, 8);
}

function sectionParagraph(lines: string[]) {
  return lines.map(stripBullet).filter(Boolean).join(" ");
}

function splitList(value: string) {
  return value
    .split(/[,;|]+/)
    .map((item) => item.replace(/\s+/g, " ").trim())
    .filter((item) => item.length > 1 || /^[A-Z]$/.test(item));
}

function splitDates(value: string) {
  const [startDate = "", endDate = ""] = value.split(dateSeparator).map((part) => part.trim());
  return { startDate, endDate };
}

function normalizeDateLine(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function parseRoleCompany(value: string) {
  const [role = value, company = ""] = value.split("|").map((part) => part.trim());
  return { role, company };
}

function isRoleLine(line: string, nextLine: string) {
  if (!line || line.length > 140 || /^relevant modules/i.test(line)) return false;
  if (bulletPrefix.test(line)) return false;
  return (line.includes("|") || /\b(intern|engineer|developer|scientist|analyst|manager|officer|administrator|consultant)\b/i.test(line))
    && monthOrYear.test(nextLine);
}

function stripBullet(value: string) {
  return value.replace(bulletPrefix, "").trim();
}

function linkFor(text: string, pattern: RegExp, exclude = "") {
  const match = text.match(pattern)?.[0] || "";
  if (!match || (exclude && match.includes(exclude))) return "";
  return match;
}

function inferTechnologies(value: string) {
  const technologies = ["Python", "SQL", "Java", "R", "Power BI", "Excel", "DHIS2", "FHIR", "HIE", "NLP", "Machine learning"];
  return technologies.filter((tech) => new RegExp(`\\b${escapeRegExp(tech)}\\b`, "i").test(value));
}

function chooseClean(primary: string, fallback: string, preferFormattedFallback = false) {
  const cleanPrimary = repairString(primary).trim();
  const cleanFallback = repairString(fallback).trim();
  if (preferFormattedFallback && isAllCapsPhrase(cleanPrimary) && cleanFallback && !isAllCapsPhrase(cleanFallback)) {
    return cleanFallback;
  }
  return cleanPrimary || cleanFallback;
}

function mergeByKey<T>(primary: T[], fallback: T[], keyFor: (item: T) => string) {
  const seen = new Set<string>();
  return [...primary, ...fallback].filter((item) => {
    const key = keyFor(item).toLowerCase().replace(/\s+/g, " ").trim();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function mergeProjectItems(primary: ProjectItem[], fallback: ProjectItem[]) {
  const byKey = new Map<string, ProjectItem>();
  for (const item of [...primary, ...fallback]) {
    const key = projectKey(item);
    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, item);
      continue;
    }
    byKey.set(key, {
      name: chooseClean(existing.name, item.name),
      role: chooseClean(existing.role, item.role),
      technologies: unique([...existing.technologies, ...item.technologies]),
      description: chooseClean(existing.description, item.description),
      outcome: chooseClean(existing.outcome, item.outcome),
    });
  }
  return [...byKey.values()];
}

function projectKey(item: ProjectItem) {
  const name = normalizeKey(item.name);
  return `project:${name || normalizeKey([item.role, item.description].join(" "))}`;
}

function educationKey(item: EducationItem) {
  const combined = normalizeKey([item.qualification, item.field, item.institution, item.details].join(" "));
  if (combined.includes("advanced level")) return "education:zimsec-advanced-level";
  if (combined.includes("ordinary level")) return "education:zimsec-ordinary-level";
  if (combined.includes("nust") || combined.includes("national university of science and technology")) {
    const field = combined.includes("informatics") ? "informatics" : normalizeKey(item.field || item.qualification);
    return `education:nust:${field || item.startDate || item.qualification}`;
  }
  return `education:${normalizeKey([item.qualification, item.field, item.institution, item.startDate].join(" "))}`;
}

function certificationKey(item: CertificationItem) {
  return `certification:${normalizeKey([item.name, item.issuer].join(" "))}`;
}

function expandCertificationItems(items: CertificationItem[]) {
  return items.flatMap(expandCertificationItem);
}

function expandCertificationItem(item: CertificationItem): CertificationItem[] {
  return item.name.split(";").map((name, index) => ({
    name: name.trim(),
    issuer: index === 0 ? item.issuer : "",
    date: index === 0 ? item.date : "",
  })).filter((certification) => certification.name);
}

function certificationFromLine(line: string): CertificationItem {
  const [name, issuer = ""] = line.split(titleSeparator).map((part) => part.trim());
  return { name, issuer, date: "" };
}

function normalizeKey(value: string) {
  return repairString(value).toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function formatAllCapsPhrase(value: string) {
  const clean = repairString(value).trim();
  if (!isAllCapsPhrase(clean)) return clean;
  return clean
    .toLowerCase()
    .replace(/\b[a-z]/g, (letter) => letter.toUpperCase())
    .replace(/\bAi\b/g, "AI")
    .replace(/\bMl\b/g, "ML")
    .replace(/\bSql\b/g, "SQL")
    .replace(/\bNlp\b/g, "NLP");
}

function isAllCapsPhrase(value: string) {
  const letters = value.replace(/[^A-Za-z]/g, "");
  return letters.length > 3 && letters === letters.toUpperCase();
}

function repairValue(value: unknown): unknown {
  if (typeof value === "string") return repairString(value);
  if (Array.isArray(value)) return value.map(repairValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, repairValue(item)]));
  }
  return value;
}

function repairString(value: string) {
  return repairEncoding(value)
    .replace(/\s+/g, " ")
    .trim();
}

function repairEncoding(value: string) {
  return value
    .replace(/\u00e2\u20ac\u2122|\u00c3\u00a2\u00e2\u201a\u00ac\u00e2\u201e\u00a2/g, "'")
    .replace(/\u00e2\u20ac\u02dc|\u00c3\u00a2\u00e2\u201a\u00ac\u00cb\u0153/g, "'")
    .replace(/\u00e2\u20ac\u0153|\u00c3\u00a2\u00e2\u201a\u00ac\u00c5\u201c/g, '"')
    .replace(/\u00e2\u20ac\u009d|\u00c3\u00a2\u00e2\u201a\u00ac\u00c2\u009d/g, '"')
    .replace(/\u00e2\u20ac\u201c|\u00e2\u20ac\u201d|\u00c3\u00a2\u00e2\u201a\u00ac\u00e2\u20ac\u0153|\u00c3\u00a2\u00e2\u201a\u00ac\u00e2\u20ac\u009d/g, "-")
    .replace(/\u00e2\u20ac\u00a2|\u00c3\u00a2\u00e2\u201a\u00ac\u00c2\u00a2/g, "\u2022");
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
