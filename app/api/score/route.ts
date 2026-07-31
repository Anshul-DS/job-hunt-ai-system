/**
 * The core loop, in order:
 *   extract (code) → gate (code) → score (one model call) → total (code)
 *
 * Note the early return: a gate failure returns before the API key is even
 * read. Dropped roles cost nothing.
 */

import { NextResponse } from "next/server";
import { extractFields, type ManualOverrides } from "@/lib/extract";
import { runGates } from "@/lib/gates";
import { loadMasterResume, MissingResumeError } from "@/lib/resume";
import { scoreJob } from "@/lib/score";

export const runtime = "nodejs";

export async function POST(request: Request) {
  let body: { jdText?: string; overrides?: ManualOverrides };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const jdText = body.jdText?.trim();
  if (!jdText) {
    return NextResponse.json({ error: "Paste a job description first." }, { status: 400 });
  }

  // 1 & 2 — deterministic. No model, no spend.
  const fields = extractFields(jdText, body.overrides ?? {});
  const gates = runGates(fields);

  if (!gates.passed) {
    return NextResponse.json({ verdict: "DROPPED", fields, gates });
  }

  // 3 — survivors only.
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      {
        error:
          "ANTHROPIC_API_KEY is not set. Copy .env.example to .env.local and add your key, then restart the dev server.",
      },
      { status: 500 },
    );
  }

  try {
    const resumeText = await loadMasterResume();
    const score = await scoreJob(jdText, resumeText, fields, apiKey);
    return NextResponse.json({ verdict: "SCORED", fields, gates, score });
  } catch (err) {
    if (err instanceof MissingResumeError) {
      return NextResponse.json({ error: err.message }, { status: 500 });
    }
    const message = err instanceof Error ? err.message : "Scoring failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
