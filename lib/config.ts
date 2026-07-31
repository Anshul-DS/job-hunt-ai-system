/**
 * All tunable policy in one place: what gates, what scores, and how much.
 *
 * The point of centralizing this is inspectability — the weights are the
 * argument this project is making, so they should be readable without
 * digging through scoring logic. See PRD.md §4 and §5.
 */

// ---------------------------------------------------------------------------
// Gates (deterministic — see lib/gates.ts)
// ---------------------------------------------------------------------------

/** Municipalities reachable from Whitby, ON for an onsite/hybrid role. */
export const GTA_COMMUTABLE = [
  "toronto",
  "markham",
  "scarborough",
  "pickering",
  "ajax",
  "whitby",
  "oshawa",
  "north york",
  "vaughan",
  "richmond hill",
  "etobicoke",
  "mississauga",
  "brampton",
  "don mills",
  "downtown toronto",
] as const;

/** Titles at or above the seniority floor. Below these = dropped. */
export const SENIOR_TITLE_MARKERS = [
  "senior",
  "sr.",
  "sr ",
  "staff",
  "lead",
  "principal",
  "head of product",
  "director of product",
  "group product manager",
  "gpm",
] as const;

/** A role must read as product management to survive the domain gate. */
export const PM_TITLE_MARKERS = [
  "product manager",
  "product management",
  "product owner",
  "product lead",
  "head of product",
  "director of product",
  "principal product",
  "group product manager",
] as const;

/**
 * Industry tiers. The gate accepts any of the three; the score ranks between
 * them. Anything matching none of these is noise and gets dropped.
 */
export const DOMAIN_TIERS = {
  tier1: {
    label: "Enterprise B2B SaaS / dev tools / DevEx",
    keywords: [
      "b2b saas", "enterprise software", "developer tools", "devtools",
      "developer experience", "devex", "devops", "ci/cd", "continuous integration",
      "platform engineering", "api platform", "sdk", "infrastructure software",
      "cloud infrastructure", "observability", "software supply chain",
    ],
  },
  tier2: {
    label: "Analytics / AI / data platforms",
    keywords: [
      "analytics", "business intelligence", "data platform", "data infrastructure",
      "machine learning", "artificial intelligence", "ai platform", "ml platform",
      "data science", "data warehouse", "market research", "measurement",
    ],
  },
  tier3: {
    label: "Fintech",
    keywords: [
      "fintech", "financial technology", "payments", "banking", "lending",
      "insurance", "insurtech", "wealth management", "capital markets",
      "financial services", "accounts receivable", "treasury",
    ],
  },
} as const;

export type DomainTier = keyof typeof DOMAIN_TIERS;

// ---------------------------------------------------------------------------
// Weights (the AI layer — see lib/score.ts)
// ---------------------------------------------------------------------------

export type DimensionKey =
  | "resumeFit"
  | "domainFit"
  | "engagementType"
  | "seniorityRank"
  | "aiContent"
  | "salary"
  | "companyStage";

export interface Dimension {
  key: DimensionKey;
  label: string;
  weight: number;
  /** Shown in the UI so the reasoning behind each weight is visible, not implied. */
  rationale: string;
}

/**
 * Weights are relative, not percentages — code normalizes them at scoring time
 * (lib/score.ts), so adding a dimension doesn't require rebalancing the rest.
 *
 * Salary is deliberately the lowest non-optional weight. That is the entire
 * point of the project: it's the preference that was wrongly averaged against
 * a hard constraint in the original bug. Raising it re-creates the bug.
 */
export const DIMENSIONS: Dimension[] = [
  {
    key: "resumeFit",
    label: "Resume fit",
    weight: 10,
    rationale:
      "Does the master resume actually support a case for this role? Without this the score only measures the JD, never the candidate.",
  },
  {
    key: "domainFit",
    label: "Domain fit",
    weight: 10,
    rationale:
      "Tier 1 (B2B SaaS / dev tools) > Tier 2 (analytics / AI platforms) > Tier 3 (fintech). The gate already confirmed it's one of the three; this ranks among them.",
  },
  {
    key: "engagementType",
    label: "Engagement type",
    weight: 10,
    rationale:
      "Permanent scores above contract. A real standing preference — but not a gate, because a contract role is still worth seeing.",
  },
  {
    key: "seniorityRank",
    label: "Seniority rank",
    weight: 6,
    rationale:
      "Everything here already cleared the Senior floor. This ranks how far above it: Principal / Staff / Lead > Senior.",
  },
  {
    key: "aiContent",
    label: "AI / agentic scope",
    weight: 6,
    rationale: "Positioning bet — roles with genuine AI or agentic scope score higher.",
  },
  {
    key: "salary",
    label: "Salary",
    weight: 3,
    rationale:
      "Deliberately low. This is the exact preference that got averaged against a location dealbreaker in the original failure. Missing salary is not a penalty.",
  },
  {
    key: "companyStage",
    label: "Company stage / size",
    weight: 2,
    rationale: "Tie-breaker only.",
  },
];

/** Reference point for the salary sub-score. Not a gate — informs, never drops. */
export const SALARY_FLOOR_CAD = 140_000;

// ---------------------------------------------------------------------------
// Bands (see lib/score.ts)
// ---------------------------------------------------------------------------

export type Band = "Strong" | "Competitive" | "Stretch";
export type Recommendation = "Yes" | "Maybe" | "No";

export interface BandRule {
  min: number;
  band: Band;
  recommendation: Recommendation;
}

/**
 * "Misaligned" — the analyzer's fourth band — is deliberately absent. Roles
 * that would have earned it are now dropped by a gate before scoring, which is
 * a small piece of evidence the gate does real work.
 */
export const BANDS: BandRule[] = [
  { min: 8, band: "Strong", recommendation: "Yes" },
  { min: 5, band: "Competitive", recommendation: "Maybe" },
  { min: 0, band: "Stretch", recommendation: "No" },
];

// ---------------------------------------------------------------------------
// Model
// ---------------------------------------------------------------------------

export const MODEL = "claude-opus-5";

/** Per-MTok pricing, used to surface run cost. Cost visibility is a design goal. */
export const PRICING = { inputPerMTok: 5, outputPerMTok: 25 } as const;
