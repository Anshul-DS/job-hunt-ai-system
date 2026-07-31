/**
 * Loads the master resume from disk, once per run.
 *
 * Read server-side only. The file lives in a gitignored directory (PRD.md §10)
 * because it's personal data — name, contact info, employer history — not just
 * config. It is never bundled into client code and never committed.
 */

import { readFile } from "node:fs/promises";
import path from "node:path";

export const RESUME_PATH = path.join(process.cwd(), "resume", "master_resume.txt");

export class MissingResumeError extends Error {
  constructor() {
    super(
      `No master resume found at resume/master_resume.txt.\n\n` +
        `Create it with your resume as plain text:\n` +
        `  mkdir -p resume && pbpaste > resume/master_resume.txt\n\n` +
        `The resume/ directory is gitignored — it never enters the repo.`,
    );
    this.name = "MissingResumeError";
  }
}

export async function loadMasterResume(): Promise<string> {
  try {
    const text = await readFile(RESUME_PATH, "utf8");
    if (text.trim().length === 0) throw new MissingResumeError();
    return text;
  } catch (err) {
    if (err instanceof MissingResumeError) throw err;
    if ((err as NodeJS.ErrnoException).code === "ENOENT") throw new MissingResumeError();
    throw err;
  }
}
