import { z } from "zod";

const email = z.string().trim().email().max(254);
const password = z.string().min(8).max(128);

export const authSchema = z.object({
  email,
  password,
});

const stringArray = z.array(z.string().trim().max(500)).default([]);

export const careerProfileSchema = z.object({
  personalDetails: z.object({
    fullName: z.string().trim().max(160).default(""),
    email: z.string().trim().max(254).default(""),
    phone: z.string().trim().max(80).default(""),
    location: z.string().trim().max(160).default(""),
    linkedin: z.string().trim().max(300).default(""),
    portfolio: z.string().trim().max(300).default(""),
  }),
  targetRoles: stringArray,
  professionalSummary: z.string().trim().max(3000).default(""),
  education: z.array(z.object({
    institution: z.string().trim().max(200).default(""),
    qualification: z.string().trim().max(200).default(""),
    field: z.string().trim().max(200).default(""),
    startDate: z.string().trim().max(80).default(""),
    endDate: z.string().trim().max(80).default(""),
    details: z.string().trim().max(1000).default(""),
  })).default([]),
  experience: z.array(z.object({
    company: z.string().trim().max(200).default(""),
    role: z.string().trim().max(200).default(""),
    location: z.string().trim().max(160).default(""),
    startDate: z.string().trim().max(80).default(""),
    endDate: z.string().trim().max(80).default(""),
    bullets: stringArray,
  })).default([]),
  projects: z.array(z.object({
    name: z.string().trim().max(200).default(""),
    role: z.string().trim().max(200).default(""),
    technologies: stringArray,
    description: z.string().trim().max(1500).default(""),
    outcome: z.string().trim().max(1000).default(""),
  })).default([]),
  volunteering: stringArray,
  skills: z.object({
    technical: stringArray,
    tools: stringArray,
    soft: stringArray,
    languages: stringArray,
  }),
  certifications: z.array(z.object({
    name: z.string().trim().max(200).default(""),
    issuer: z.string().trim().max(200).default(""),
    date: z.string().trim().max(80).default(""),
  })).default([]),
  achievements: stringArray,
  references: z.string().trim().max(1000).default(""),
});

export const generateCvSchema = z.object({
  profile: careerProfileSchema,
  jobTitle: z.string().trim().max(200).default(""),
  jobDescription: z.string().trim().min(20).max(20000),
  template: z.enum(["firstjob", "ats", "graduate", "technical"]).default("firstjob"),
});
