import { execFile } from "child_process";
import { promises as fs } from "fs";
import os from "os";
import path from "path";
import { promisify } from "util";
import { createCvPdf } from "./pdf";
import { createFirstJobTemplateDocx } from "./docx-template";
import type { CvDocument } from "./types";

const execFileAsync = promisify(execFile);

export async function createTemplatePdf(cv: CvDocument) {
  const workingDir = await fs.mkdtemp(path.join(os.tmpdir(), "careerpilot-pdf-"));
  const profileDir = path.join(workingDir, "lo-profile");
  const docxPath = path.join(workingDir, "cv.docx");
  const pdfPath = path.join(workingDir, "cv.pdf");

  try {
    await fs.mkdir(profileDir, { recursive: true });
    await fs.writeFile(docxPath, await createFirstJobTemplateDocx(cv));

    await execFileAsync(
      await resolveLibreOfficeCommand(),
      [
        "--headless",
        "--nologo",
        "--nofirststartwizard",
        `-env:UserInstallation=file:///${profileDir.replace(/\\/g, "/")}`,
        "--convert-to",
        "pdf",
        "--outdir",
        workingDir,
        docxPath,
      ],
      {
        timeout: 60_000,
        env: {
          ...process.env,
          HOME: workingDir,
        },
      },
    );

    return await fs.readFile(pdfPath);
  } catch {
    return createCvPdf(cv);
  } finally {
    await fs.rm(workingDir, { recursive: true, force: true });
  }
}

async function resolveLibreOfficeCommand() {
  const candidates = process.platform === "win32"
    ? ["soffice.exe", "libreoffice.exe"]
    : ["soffice", "libreoffice"];

  for (const command of candidates) {
    try {
      await execFileAsync(command, ["--version"], { timeout: 10_000 });
      return command;
    } catch {
      // Try the next common executable name.
    }
  }

  throw new Error("LibreOffice executable not found.");
}
