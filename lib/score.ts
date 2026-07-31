/**
 * The AI layer — one model call, survivors only.
 *
 * Note what the model does and does not do here. It returns a sub-score per
 * dimension plus prose. It does NOT compute the total: code multiplies the
 * sub-scores by the weights and sums them (`computeWeightedTotal` below).
 *
 * That's the second deterministic boundary, and it's deliberate. The original
 * bug lived in the *combination* step, not in the individual judgments —
 * handing combination back to a model would reinstate the bug somewhere
 * harder to see. See design-decision.md §2.
 */

import Anthropic from "@anthropic-ai/sdk";
import {
  BANDS, DIMENSIONS, DOMAIN_TIERS, MODEL, PRICING, SALARY_FLOOR_CAD,
  type Band, type DimensionKey, type Recommendation,
} from "./config";
import type { ExtractedFields } from "./extract";

export interface SubScore {
  key: DimensionKey;
  label: string;
  /** 0–10, from the model. */
  score: number;
  weight: number;
  /** One line on why this dimension landed where it did. */
  note: string;
}

export interface ResumeGap {
  jdWants: string;
  resumeShows: string;
}

export interface ScoreResult {
  total: number;
  band: Band;
  recommendation: Recommendation;
  subScores: SubScore[];
  resumeGaps: ResumeGap[];
  rationale: string;
  mustHaves: string[];
  usage: { inputTokens: number; outputTokens: number; estimatedCostUsd: number };
}

/** Shape the model is constrained to return. Sub-scores only — never the total. */
const RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    subScores: {
      type: "object",
      properties: Object.fromEntries(
        DIMENSIONS.map((d) => [
          d.key,
          {
            type: "object",
            properties: {
              score: { type: "integer", description: "0-10" },
              note: { type: "string", description: "One sentence, grounded in the JD or resume text." },
            },
            required: ["score", "note"],
            additionalProperties: false,
          },
        ]),
      ),
      required: DIMENSIONS.map((d) => d.key),
      additionalProperties: false,
    },
    resumeGaps: {
      type: "array",
      description: "Requirements the JD asks for that the resume does not visibly support. Empty if none.",
      items: {
        type: "object",
        properties: {
          jdWants: { type: "string" },
          resumeShows: { type: "string" },
        },
        required: ["jdWants", "resumeShows"],
        additionalProperties: false,
      },
    },
    mustHaves: {
      type: "array",
      description: "Top 3-5 must-have requirements extracted from the JD.",
      items: { type: "string" },
    },
    rationale: { type: "string", description: "2-3 sentences on the overall fit." },
  },
  required: ["subScores", "resumeGaps", "mustHaves", "rationale"],
  additionalProperties: false,
} as const;

function buildSystemPrompt(): string {
  const dimensionSpec = DIMENSIONS.map(
    (d) => `- ${d.key} (${d.label}): ${d.rationale}`,
  ).join("\n");

  const tierSpec = (Object.keys(DOMAIN_TIERS) as Array<keyof typeof DOMAIN_TIERS>)
    .map((t) => `  - ${t}: ${DOMAIN_TIERS[t].label}`)
    .join("\n");

  return `You score how well a job posting fits one specific candidate, given their resume.

The role has already passed a set of hard constraints (location, country eligibility, seniority floor, industry) — those are settled and are not your concern. Your job is only to rate the trade-offs.

Score each dimension 0-10:

${dimensionSpec}

Scoring guidance:
- resumeFit: 10 = the resume directly evidences what the JD asks for. 5 = partial or adjacent evidence. 0 = the resume does not support a case for this role. Judge only what the resume actually says.
- domainFit: rank within the accepted tiers —
${tierSpec}
  Tier 1 should score 8-10, Tier 2 5-7, Tier 3 2-4.
- engagementType: permanent 8-10, contract 3-5, unstated 6.
- seniorityRank: Principal/Staff/Lead 8-10, Senior 6-7. Everything here already cleared the Senior floor.
- aiContent: genuine AI/agentic product scope 8-10, some AI adjacency 4-6, none 1-3.
- salary: at or above CAD ${SALARY_FLOOR_CAD.toLocaleString()} scores 8-10, below scores lower in proportion. If salary is not stated, return exactly 6 and say it was unstated — a missing salary is not a penalty.
- companyStage: tie-breaker only; return 5 when there is nothing to go on.

Rules:
- Every claim in a note, a gap, or the rationale must trace to specific text in the job posting or the resume. Never invent a requirement or a credential.
- A fabricated gap is worse than a missed one — it pushes the candidate away from a role they should apply to, with an authoritative-sounding reason. If you are not sure the resume lacks something, do not list it as a gap.
- Do not compute an overall score. Return per-dimension sub-scores only; the total is computed separately in code.`;
}

/** Code owns the arithmetic. The model never sees or produces this number. */
export function computeWeightedTotal(subScores: SubScore[]): number {
  const totalWeight = subScores.reduce((sum, s) => sum + s.weight, 0);
  if (totalWeight === 0) return 0;
  const weighted = subScores.reduce((sum, s) => sum + s.score * s.weight, 0);
  return Math.round((weighted / totalWeight) * 10) / 10;
}

export function bandFor(total: number): BandRuleResult {
  const rule = BANDS.find((b) => total >= b.min) ?? BANDS[BANDS.length - 1];
  return { band: rule.band, recommendation: rule.recommendation };
}
interface BandRuleResult { band: Band; recommendation: Recommendation }

export async function scoreJob(
  jdText: string,
  resumeText: string,
  fields: ExtractedFields,
  apiKey: string,
): Promise<ScoreResult> {
  const client = new Anthropic({ apiKey });

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 16000,
    thinking: { type: "adaptive" },
    system: buildSystemPrompt(),
    output_config: { format: { type: "json_schema", schema: RESPONSE_SCHEMA } },
    messages: [
      {
        role: "user",
        content: `Here is the candidate's master resume:

<resume>
${resumeText}
</resume>

Here is the job posting to score:

<job_posting>
${jdText}
</job_posting>

Fields already extracted deterministically (use these; do not re-derive them):
- Title: ${fields.title ?? "not stated"}
- Work arrangement: ${fields.arrangement ?? "not stated"}
- Domain tier: ${fields.domainTier ?? "not detected"}
- Engagement type: ${fields.engagement ?? "not stated"}

Score the trade-off dimensions.`,
      },
    ],
  });

  if (response.stop_reason === "refusal") {
    throw new Error("The model declined to score this posting.");
  }

  const textBlock = response.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("No scoring output returned by the model.");
  }

  const parsed = JSON.parse(textBlock.text) as {
    subScores: Record<DimensionKey, { score: number; note: string }>;
    resumeGaps: ResumeGap[];
    mustHaves: string[];
    rationale: string;
  };

  const subScores: SubScore[] = DIMENSIONS.map((d) => ({
    key: d.key,
    label: d.label,
    weight: d.weight,
    score: Math.max(0, Math.min(10, parsed.subScores[d.key]?.score ?? 0)),
    note: parsed.subScores[d.key]?.note ?? "",
  }));

  const total = computeWeightedTotal(subScores);
  const { band, recommendation } = bandFor(total);

  const inputTokens = response.usage.input_tokens;
  const outputTokens = response.usage.output_tokens;

  return {
    total,
    band,
    recommendation,
    subScores,
    resumeGaps: parsed.resumeGaps ?? [],
    mustHaves: parsed.mustHaves ?? [],
    rationale: parsed.rationale,
    usage: {
      inputTokens,
      outputTokens,
      estimatedCostUsd:
        (inputTokens / 1_000_000) * PRICING.inputPerMTok +
        (outputTokens / 1_000_000) * PRICING.outputPerMTok,
    },
  };
}
