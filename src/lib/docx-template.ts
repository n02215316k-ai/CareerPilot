import fs from "fs";
import path from "path";
import JSZip from "jszip";
import type { CvDocument, CvExperience, CvProject } from "./types";

const templatePath = path.join(process.cwd(), "templates", "firstjobcvstartertemplatep2plus.docx");

const roleIndexes = {
  name: 0,
  targetRole: 1,
  location: 2,
  contact: 3,
  heading: 4,
  body: 5,
  blank: 6,
  skill: 8,
  education: 11,
  experienceTitle: 16,
  experienceBody: 17,
  project: 24,
  volunteering: 23,
  references: 26,
};

export async function createFirstJobTemplateDocx(cv: CvDocument) {
  const zip = await JSZip.loadAsync(fs.readFileSync(templatePath));
  const documentFile = zip.file("word/document.xml");
  if (!documentFile) throw new Error("Template is missing word/document.xml.");

  const documentXml = await documentFile.async("string");
  const paragraphs = documentXml.match(/<w:p[\s\S]*?<\/w:p>/g) || [];
  const sectPr = documentXml.match(/<w:sectPr[\s\S]*?<\/w:sectPr>/)?.[0] || "";
  if (paragraphs.length < 27 || !sectPr) {
    throw new Error("CV template structure is not recognized.");
  }

  const identity = identityFromCv(cv);
  const blocks: string[] = [
    paragraphRuns(paragraphs[roleIndexes.name], ["[", identity.name, "]"]),
    paragraphText(paragraphs[roleIndexes.targetRole], `(${identity.role.toUpperCase()})`),
    paragraphText(paragraphs[roleIndexes.location], identity.location),
    paragraphText(paragraphs[roleIndexes.contact], identity.contact),
    paragraphText(paragraphs[roleIndexes.heading], "PERSONAL PROFILE"),
    ...paragraphsForText(paragraphs[roleIndexes.body], cv.summary || "Professional candidate with verified skills and experience aligned to the target role."),
    paragraphText(paragraphs[roleIndexes.blank], ""),
    paragraphText(paragraphs[roleIndexes.heading], "KEY SKILLS"),
    ...skillLines(cv.skills).map((line) => paragraphText(paragraphs[roleIndexes.skill], line)),
    paragraphText(paragraphs[roleIndexes.heading], "EDUCATION"),
    ...educationLines(cv).map((line, index) => educationParagraph(paragraphs[roleIndexes.education], line, index + 1)),
    paragraphText(paragraphs[roleIndexes.blank], ""),
    paragraphText(paragraphs[roleIndexes.heading], "EXPERIENCE"),
    ...experienceParagraphs(paragraphs, cv.experience),
    ...volunteeringParagraphs(paragraphs, cv.volunteering),
    ...projectParagraphs(paragraphs, cv.projects),
    paragraphText(paragraphs[roleIndexes.heading], "REFERENCES"),
    paragraphText(paragraphs[roleIndexes.references], cv.references || "Available on request"),
  ];

  const nextDocumentXml = documentXml.replace(
    /<w:body>[\s\S]*?<\/w:body>/,
    `<w:body>${blocks.join("")}${sectPr}</w:body>`,
  );

  zip.file("word/document.xml", nextDocumentXml);
  return zip.generateAsync({
    type: "nodebuffer",
    compression: "DEFLATE",
    compressionOptions: { level: 6 },
  });
}

function identityFromCv(cv: CvDocument) {
  const splitTitle = cv.title.split(/\s+-\s+/);
  const contactParts = cv.contact.split("|").map((part) => part.trim()).filter(Boolean);
  const email = cv.email || contactParts.find((part) => part.includes("@")) || "";
  const phone = cv.phone || contactParts.find((part) => /\d/.test(part) && !part.includes("@")) || "";
  const location = cv.location || contactParts.find((part) => !part.includes("@") && !/\d/.test(part)) || "";
  const links = [cv.linkedin, cv.portfolio].filter(Boolean);

  return {
    name: cv.candidateName || splitTitle[0] || "Candidate",
    role: cv.targetRole || splitTitle[1] || "Professional Candidate",
    location,
    contact: [phone, email, ...links].filter(Boolean).join(" | "),
  };
}

function educationLines(cv: CvDocument) {
  const lines = [...cv.education];
  if (cv.certifications.length) {
    lines.push(...cv.certifications.map((item) => `Certification: ${item}`));
  }
  return lines.length ? lines : ["Education details available on request"];
}

function experienceParagraphs(paragraphs: string[], experience: CvExperience[]) {
  if (!experience.length) {
    return [paragraphText(paragraphs[roleIndexes.experienceBody], "Experience details available on request.")];
  }

  return experience.flatMap((item) => {
    const dates = item.dates ? ` - ${item.dates}` : "";
    const title = paragraphRuns(paragraphs[roleIndexes.experienceTitle], [
      `${item.role || "Role"} `,
      "(",
      item.company || "Company",
      dates,
      ")",
    ]);
    const bullets = item.bullets.length ? item.bullets : ["Responsibilities available on request."];
    return [title, ...bullets.flatMap((bullet) => paragraphsForText(paragraphs[roleIndexes.experienceBody], bullet))];
  });
}

function projectParagraphs(paragraphs: string[], projects: CvProject[]) {
  if (!projects.length) return [];

  const projectText = projects
    .map((project) => {
      const tech = project.technologies.length ? ` (${project.technologies.join(", ")})` : "";
      const details = project.bullets.join(" ");
      return [project.name + tech, details].filter(Boolean).join(": ");
    })
    .join(" ");

  return [paragraphRuns(paragraphs[roleIndexes.project], ["Projects: ", projectText, ""])];
}

function volunteeringParagraphs(paragraphs: string[], volunteering: string[]) {
  const clean = unique(volunteering).slice(0, 6);
  if (!clean.length) return [];
  return [paragraphRuns(paragraphs[roleIndexes.volunteering], ["Volunteering: ", clean.join(", "), ""])];
}

function skillLines(skills: string[]) {
  const clean = unique(skills).slice(0, 24);
  if (!clean.length) return ["Key skills available on request"];

  const lines: string[] = [];
  let current = "";
  for (const skill of clean) {
    const next = current ? `${current} | ${skill}` : skill;
    if (next.length > 120 && current) {
      lines.push(`${current} |`);
      current = skill;
    } else {
      current = next;
    }
  }
  if (current) lines.push(`${current} |`);
  return lines.slice(0, 3);
}

function educationParagraph(template: string, line: string, number: number) {
  const [lead, ...restParts] = line.split(":");
  const rest = restParts.length ? `: ${restParts.join(":").trim()}` : "";
  return paragraphRuns(template, [`${number}`, ".", lead.trim(), rest, "", ""]);
}

function paragraphsForText(template: string, text: string) {
  const chunks = wrapText(text, 260);
  return chunks.map((chunk) => paragraphText(template, chunk));
}

function paragraphText(template: string, text: string) {
  return paragraphRuns(template, [text]);
}

function paragraphRuns(template: string, values: string[]) {
  let index = 0;
  const cleaned = cleanParagraph(template);
  return cleaned.replace(/<w:t(?:\s+xml:space="preserve")?[^>]*>[\s\S]*?<\/w:t>/g, () => {
    const value = values[index++] || "";
    const space = /^\s|\s$/.test(value) ? ' xml:space="preserve"' : "";
    return `<w:t${space}>${escapeXml(value)}</w:t>`;
  });
}

function cleanParagraph(template: string) {
  return template
    .replace(/\s+w14:paraId="[^"]*"/g, "")
    .replace(/\s+w14:textId="[^"]*"/g, "")
    .replace(/<w:bookmarkStart\b[^>]*\/>/g, "")
    .replace(/<w:bookmarkEnd\b[^>]*\/>/g, "")
    .replace(/<w:proofErr\b[^>]*\/>/g, "");
}

function wrapText(text: string, max: number) {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length > max && current) {
      lines.push(current);
      current = word;
    } else {
      current = next;
    }
  }
  if (current) lines.push(current);
  return lines.length ? lines : [""];
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

function escapeXml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
