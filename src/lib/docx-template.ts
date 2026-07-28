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
  skillSecond: 9,
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
    ...skillLines(cv.skills).map((line, index) => paragraphText(paragraphs[index === 1 ? roleIndexes.skillSecond : roleIndexes.skill], line)),
    paragraphText(paragraphs[roleIndexes.heading], "EDUCATION"),
    ...educationLines(cv).map((line, index) => educationParagraph(paragraphs, line, index + 1)),
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

  return experience.flatMap((item, index) => {
    const dates = item.dates ? ` - ${item.dates}` : "";
    const title = paragraphRuns(paragraphs[roleIndexes.experienceTitle], [
      `${item.role || "Role"} `,
      "(",
      item.company || "Company",
      dates,
      ")",
    ]);
    const bullets = item.bullets.length ? item.bullets : ["Responsibilities available on request."];
    return [
      ...(index >= 2 ? [paragraphText(paragraphs[roleIndexes.blank], "")] : []),
      title,
      ...bullets.flatMap((bullet) => paragraphsForText(paragraphs[roleIndexes.experienceBody], bullet)),
    ];
  });
}

function projectParagraphs(paragraphs: string[], projects: CvProject[]) {
  if (!projects.length) return [];

  const projectText = projects
    .map((project) => {
      const tech = project.technologies.length ? ` (${project.technologies.join(", ")})` : "";
      const details = project.bullets.join(" ");
      return ensureSentencePeriod([project.name + tech, details].filter(Boolean).join(": "));
    })
    .join(" ");

  return [paragraphRuns(paragraphs[roleIndexes.project], ["Projects: ", projectText, ""])];
}

function volunteeringParagraphs(paragraphs: string[], volunteering: string[]) {
  const clean = unique(volunteering).slice(0, 6);
  if (!clean.length) return [];
  return [paragraphRuns(paragraphs[roleIndexes.volunteering], ["Volunteering: ", ensureSentencePeriod(clean.join(", ")), ""])];
}

function skillLines(skills: string[]) {
  const clean = unique(skills).slice(0, 24);
  if (!clean.length) return ["Key skills available on request"];

  const lines: string[] = [];
  let current = "";
  for (const skill of clean) {
    const next = current ? `${current} | ${skill}` : skill;
    if (next.length > 175 && current) {
      lines.push(`${current} |`);
      current = skill;
    } else {
      current = next;
    }
  }
  if (current) lines.push(`${current} |`);
  return lines.slice(0, 3);
}

function educationParagraph(paragraphs: string[], line: string, number: number) {
  const parts = splitEducationLine(line);
  const template = paragraphs[roleIndexes.education + Math.min(number - 1, 2)] || paragraphs[roleIndexes.education];

  if (parts.keyLabel) {
    return paragraphRuns(template, [
      `${number}`,
      ".",
      parts.lead,
      parts.middle,
      "",
      "",
      " / ",
      parts.keyLabel,
      parts.after,
    ]);
  }

  if (number === 2) {
    return paragraphRuns(template, [" ", `${number}`, ".", parts.lead, parts.rest]);
  }

  return paragraphRuns(template, [`${number}`, ".", parts.lead, parts.rest]);
}

function paragraphsForText(template: string, text: string) {
  const chunks = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  return (chunks.length ? chunks : [""]).map((chunk) => paragraphText(template, chunk));
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

function splitEducationLine(line: string) {
  const clean = line.replace(/^\s*\d+\s*[.)]\s*/, "").trim();
  const keyMatch = clean.match(/^(.*?)\s*\/\s*(.*?)\s*\/\s*(Key Modules)\s*(.*)$/i);
  if (keyMatch) {
    return {
      lead: keyMatch[1].trim(),
      middle: `/${keyMatch[2].trim()}`,
      keyLabel: keyMatch[3].trim(),
      after: keyMatch[4].trim() ? ` ${keyMatch[4].trim()}` : "",
      rest: "",
    };
  }

  const colonIndex = clean.indexOf(":");
  if (colonIndex > -1) {
    return {
      lead: clean.slice(0, colonIndex).trim(),
      rest: `: ${clean.slice(colonIndex + 1).trim()}`,
      keyLabel: "",
      middle: "",
      after: "",
    };
  }

  const commaIndex = clean.indexOf(",");
  if (commaIndex > -1) {
    return {
      lead: clean.slice(0, commaIndex).trim(),
      rest: clean.slice(commaIndex).trim(),
      keyLabel: "",
      middle: "",
      after: "",
    };
  }

  return {
    lead: clean,
    rest: "",
    keyLabel: "",
    middle: "",
    after: "",
  };
}

function ensureSentencePeriod(value: string) {
  const clean = value.trim();
  return clean && !/[.!?)]$/.test(clean) ? `${clean}.` : clean;
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
