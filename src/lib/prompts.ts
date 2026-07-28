import type { CareerProfile } from "./types";

export function extractionPrompt(cvText: string) {
  return `
You are CareerPilot AI, a factual CV extraction assistant.

Extract only facts present in the CV text. Do not invent employers, dates, qualifications, technologies, achievements or results.

Return valid JSON with this exact shape:
{
  "profile": {
    "personalDetails": {"fullName":"","email":"","phone":"","location":"","linkedin":"","portfolio":""},
    "targetRoles": [],
    "professionalSummary": "",
    "education": [{"institution":"","qualification":"","field":"","startDate":"","endDate":"","details":""}],
    "experience": [{"company":"","role":"","location":"","startDate":"","endDate":"","bullets": []}],
    "projects": [{"name":"","role":"","technologies":[],"description":"","outcome":""}],
    "skills": {"technical":[],"tools":[],"soft":[],"languages":[]},
    "certifications": [{"name":"","issuer":"","date":""}],
    "achievements": [],
    "references": ""
  },
  "missingInformation": []
}

CV text:
${cvText.slice(0, 30000)}
`;
}

export function interviewPrompt(profile: CareerProfile) {
  return `
You are CareerPilot AI. Review this verified career profile and identify missing or weak information.
Ask concise questions that would help produce a stronger, truthful CV. Do not ask for invented metrics.

Return valid JSON:
{
  "questions": []
}

Career profile:
${JSON.stringify(profile)}
`;
}

export function tailoringPrompt(profile: CareerProfile, jobTitle: string, jobDescription: string, template: string) {
  return `
You are CareerPilot AI, an accurate CV tailoring assistant.

Use only facts from the verified career profile. You may improve grammar, reorder emphasis, and select relevant projects or skills. You must not invent employers, titles, dates, technologies, certificates, percentages, years of experience or outcomes.

Create an ATS-friendly CV for this role:
${jobTitle || "the supplied job description"}

Template style: ${template}

Return valid JSON with this exact shape:
{
  "title": "",
  "contact": "",
  "summary": "",
  "skills": [],
  "experience": [{"company":"","role":"","dates":"","bullets":[]}],
  "projects": [{"name":"","technologies":[],"bullets":[]}],
  "education": [],
  "certifications": [],
  "keywords": [],
  "gaps": []
}

Verified career profile:
${JSON.stringify(profile)}

Job description:
${jobDescription.slice(0, 30000)}
`;
}
