export type PersonalDetails = {
  fullName: string;
  email: string;
  phone: string;
  location: string;
  linkedin: string;
  portfolio: string;
};

export type EducationItem = {
  institution: string;
  qualification: string;
  field: string;
  startDate: string;
  endDate: string;
  details: string;
};

export type ExperienceItem = {
  company: string;
  role: string;
  location: string;
  startDate: string;
  endDate: string;
  bullets: string[];
};

export type ProjectItem = {
  name: string;
  role: string;
  technologies: string[];
  description: string;
  outcome: string;
};

export type SkillGroups = {
  technical: string[];
  tools: string[];
  soft: string[];
  languages: string[];
};

export type CertificationItem = {
  name: string;
  issuer: string;
  date: string;
};

export type CareerProfile = {
  personalDetails: PersonalDetails;
  targetRoles: string[];
  professionalSummary: string;
  education: EducationItem[];
  experience: ExperienceItem[];
  projects: ProjectItem[];
  skills: SkillGroups;
  certifications: CertificationItem[];
  achievements: string[];
  references: string;
};

export type CvExperience = {
  company: string;
  role: string;
  dates: string;
  bullets: string[];
};

export type CvProject = {
  name: string;
  technologies: string[];
  bullets: string[];
};

export type CvDocument = {
  title: string;
  candidateName?: string;
  targetRole?: string;
  location?: string;
  phone?: string;
  email?: string;
  linkedin?: string;
  portfolio?: string;
  contact: string;
  summary: string;
  skills: string[];
  experience: CvExperience[];
  projects: CvProject[];
  education: string[];
  certifications: string[];
  keywords: string[];
  gaps: string[];
};

export type GeneratedCvRecord = {
  id: string;
  title: string;
  jobTitle: string;
  template: string;
  content: CvDocument;
  createdAt: string;
};

export type SessionUser = {
  id: string;
  email: string;
};
