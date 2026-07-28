import type {
  CareerProfile,
  CertificationItem,
  CvDocument,
  EducationItem,
  ExperienceItem,
  ProjectItem,
} from "./types";

export const emptyProfile: CareerProfile = {
  personalDetails: {
    fullName: "",
    email: "",
    phone: "",
    location: "",
    linkedin: "",
    portfolio: "",
  },
  targetRoles: [],
  professionalSummary: "",
  education: [],
  experience: [],
  projects: [],
  skills: {
    technical: [],
    tools: [],
    soft: [],
    languages: [],
  },
  certifications: [],
  achievements: [],
  references: "",
};

const asString = (value: unknown) => (typeof value === "string" ? value : "");

const asStringArray = (value: unknown) =>
  Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string").map((item) => item.trim()).filter(Boolean)
    : [];

export function normalizeProfile(input: unknown): CareerProfile {
  const source = input && typeof input === "object" ? (input as Record<string, unknown>) : {};
  const personal = source.personalDetails && typeof source.personalDetails === "object"
    ? (source.personalDetails as Record<string, unknown>)
    : {};
  const skills = source.skills && typeof source.skills === "object" ? (source.skills as Record<string, unknown>) : {};

  return {
    personalDetails: {
      fullName: asString(personal.fullName),
      email: asString(personal.email),
      phone: asString(personal.phone),
      location: asString(personal.location),
      linkedin: asString(personal.linkedin),
      portfolio: asString(personal.portfolio),
    },
    targetRoles: asStringArray(source.targetRoles),
    professionalSummary: asString(source.professionalSummary),
    education: Array.isArray(source.education)
      ? source.education.map(normalizeEducation).filter(Boolean)
      : [],
    experience: Array.isArray(source.experience)
      ? source.experience.map(normalizeExperience).filter(Boolean)
      : [],
    projects: Array.isArray(source.projects)
      ? source.projects.map(normalizeProject).filter(Boolean)
      : [],
    skills: {
      technical: asStringArray(skills.technical),
      tools: asStringArray(skills.tools),
      soft: asStringArray(skills.soft),
      languages: asStringArray(skills.languages),
    },
    certifications: Array.isArray(source.certifications)
      ? source.certifications.map(normalizeCertification).filter(Boolean)
      : [],
    achievements: asStringArray(source.achievements),
    references: asString(source.references),
  };
}

function normalizeEducation(value: unknown): EducationItem {
  const item = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  return {
    institution: asString(item.institution),
    qualification: asString(item.qualification),
    field: asString(item.field),
    startDate: asString(item.startDate),
    endDate: asString(item.endDate),
    details: asString(item.details),
  };
}

function normalizeExperience(value: unknown): ExperienceItem {
  const item = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  return {
    company: asString(item.company),
    role: asString(item.role),
    location: asString(item.location),
    startDate: asString(item.startDate),
    endDate: asString(item.endDate),
    bullets: asStringArray(item.bullets),
  };
}

function normalizeProject(value: unknown): ProjectItem {
  const item = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  return {
    name: asString(item.name),
    role: asString(item.role),
    technologies: asStringArray(item.technologies),
    description: asString(item.description),
    outcome: asString(item.outcome),
  };
}

function normalizeCertification(value: unknown): CertificationItem {
  const item = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  return {
    name: asString(item.name),
    issuer: asString(item.issuer),
    date: asString(item.date),
  };
}

export function mergeProfiles(base: CareerProfile, incoming: CareerProfile): CareerProfile {
  const choose = (current: string, next: string) => current || next;
  return {
    personalDetails: {
      fullName: choose(base.personalDetails.fullName, incoming.personalDetails.fullName),
      email: choose(base.personalDetails.email, incoming.personalDetails.email),
      phone: choose(base.personalDetails.phone, incoming.personalDetails.phone),
      location: choose(base.personalDetails.location, incoming.personalDetails.location),
      linkedin: choose(base.personalDetails.linkedin, incoming.personalDetails.linkedin),
      portfolio: choose(base.personalDetails.portfolio, incoming.personalDetails.portfolio),
    },
    targetRoles: unique([...base.targetRoles, ...incoming.targetRoles]),
    professionalSummary: choose(base.professionalSummary, incoming.professionalSummary),
    education: [...base.education, ...incoming.education],
    experience: [...base.experience, ...incoming.experience],
    projects: [...base.projects, ...incoming.projects],
    skills: {
      technical: unique([...base.skills.technical, ...incoming.skills.technical]),
      tools: unique([...base.skills.tools, ...incoming.skills.tools]),
      soft: unique([...base.skills.soft, ...incoming.skills.soft]),
      languages: unique([...base.skills.languages, ...incoming.skills.languages]),
    },
    certifications: [...base.certifications, ...incoming.certifications],
    achievements: unique([...base.achievements, ...incoming.achievements]),
    references: choose(base.references, incoming.references),
  };
}

export function profileCompleteness(profile: CareerProfile) {
  const checks = [
    Boolean(profile.personalDetails.fullName),
    Boolean(profile.personalDetails.email || profile.personalDetails.phone),
    Boolean(profile.professionalSummary),
    profile.experience.length > 0,
    profile.education.length > 0,
    profile.skills.technical.length + profile.skills.tools.length > 0,
    profile.projects.length > 0,
    profile.targetRoles.length > 0,
  ];
  const complete = checks.filter(Boolean).length;
  return Math.round((complete / checks.length) * 100);
}

export function fallbackCv(profile: CareerProfile, jobTitle: string): CvDocument {
  const title = jobTitle || profile.targetRoles[0] || "Professional CV";
  const name = profile.personalDetails.fullName || "Candidate";
  const contact = [
    profile.personalDetails.email,
    profile.personalDetails.phone,
    profile.personalDetails.location,
    profile.personalDetails.linkedin,
    profile.personalDetails.portfolio,
  ].filter(Boolean).join(" | ");

  return {
    title: `${name} - ${title}`,
    contact,
    summary: profile.professionalSummary || `Candidate targeting ${title} roles with verified education, skills and project experience.`,
    skills: unique([
      ...profile.skills.technical,
      ...profile.skills.tools,
      ...profile.skills.soft,
      ...profile.skills.languages,
    ]),
    experience: profile.experience.map((item) => ({
      company: item.company,
      role: item.role,
      dates: [item.startDate, item.endDate].filter(Boolean).join(" - "),
      bullets: item.bullets.length ? item.bullets : ["Contributed verified responsibilities from the career profile."],
    })),
    projects: profile.projects.map((project) => ({
      name: project.name,
      technologies: project.technologies,
      bullets: [project.description, project.outcome].filter(Boolean),
    })),
    education: profile.education.map((item) =>
      [item.qualification, item.field, item.institution, [item.startDate, item.endDate].filter(Boolean).join(" - ")]
        .filter(Boolean)
        .join(", "),
    ),
    certifications: profile.certifications.map((item) =>
      [item.name, item.issuer, item.date].filter(Boolean).join(", "),
    ),
    keywords: unique([...profile.targetRoles, ...profile.skills.technical, ...profile.skills.tools]).slice(0, 20),
    gaps: [],
  };
}

export function normalizeCvDocument(input: unknown): CvDocument {
  const source = input && typeof input === "object" ? (input as Record<string, unknown>) : {};
  const asCvExperience = (value: unknown) => {
    const item = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
    return {
      company: asString(item.company),
      role: asString(item.role),
      dates: asString(item.dates),
      bullets: asStringArray(item.bullets),
    };
  };
  const asCvProject = (value: unknown) => {
    const item = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
    return {
      name: asString(item.name),
      technologies: asStringArray(item.technologies),
      bullets: asStringArray(item.bullets),
    };
  };

  return {
    title: asString(source.title) || "CareerPilot CV",
    contact: asString(source.contact),
    summary: asString(source.summary),
    skills: asStringArray(source.skills),
    experience: Array.isArray(source.experience) ? source.experience.map(asCvExperience) : [],
    projects: Array.isArray(source.projects) ? source.projects.map(asCvProject) : [],
    education: asStringArray(source.education),
    certifications: asStringArray(source.certifications),
    keywords: asStringArray(source.keywords),
    gaps: asStringArray(source.gaps),
  };
}

export function cvToPlainText(cv: CvDocument) {
  const lines = [
    cv.title,
    cv.contact,
    "",
    "Professional Summary",
    cv.summary,
    "",
    "Skills",
    cv.skills.join(", "),
    "",
    "Experience",
    ...cv.experience.flatMap((item) => [
      `${item.role}${item.company ? `, ${item.company}` : ""}${item.dates ? ` | ${item.dates}` : ""}`,
      ...item.bullets.map((bullet) => `- ${bullet}`),
      "",
    ]),
    "Projects",
    ...cv.projects.flatMap((item) => [
      item.name,
      item.technologies.length ? `Technologies: ${item.technologies.join(", ")}` : "",
      ...item.bullets.map((bullet) => `- ${bullet}`),
      "",
    ]),
    "Education",
    ...cv.education.map((item) => `- ${item}`),
    "",
    "Certifications",
    ...cv.certifications.map((item) => `- ${item}`),
  ];

  return lines.filter((line, index) => line || lines[index - 1]).join("\n");
}

export function unique(values: string[]) {
  const seen = new Set<string>();
  return values
    .map((value) => value.trim())
    .filter(Boolean)
    .filter((value) => {
      const key = value.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}
