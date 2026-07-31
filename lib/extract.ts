/**
 * Turn raw JD prose into the structured fields the gates need.
 *
 * This is pure code, no model call — the gate has to run before any API spend
 * (design-decision.md §2). It answers "what does this JD say?", never "is that
 * good?". Finding a fact, not judging it.
 *
 * Extraction is the real error surface of the gate layer, so ambiguity resolves
 * toward `null` — an unknown field never drops a role (see lib/gates.ts).
 */

import { GTA_COMMUTABLE, SENIOR_TITLE_MARKERS, PM_TITLE_MARKERS, DOMAIN_TIERS, type DomainTier } from "./config";

export type Arrangement = "remote" | "hybrid" | "onsite" | null;
export type Engagement = "permanent" | "contract" | null;

export interface ExtractedFields {
  title: string | null;
  location: string | null;
  arrangement: Arrangement;
  canadaEligible: boolean | null;
  isGtaCommutable: boolean | null;
  isPmTitle: boolean;
  meetsSeniorityFloor: boolean;
  domainTier: DomainTier | null;
  engagement: Engagement;
}

/** Optional structured fields a human can supply to correct a bad extraction. */
export interface ManualOverrides {
  title?: string;
  location?: string;
  arrangement?: Arrangement;
  salary?: string;
}

const norm = (s: string) => s.toLowerCase().replace(/\s+/g, " ");

function detectArrangement(text: string): Arrangement {
  // Order matters: "remote" appearing anywhere shouldn't beat an explicit
  // hybrid/onsite statement, since JDs often mention remote in passing.
  if (/\bhybrid\b|\bdays? (?:per|a) week (?:in|at) (?:the )?office\b|\bin[- ]office \d+ days?\b/.test(text)) {
    return "hybrid";
  }
  if (/\bon[- ]?site\b|\bin[- ]person\b|\brelocat(?:e|ion)\b|\bbased (?:in|out of) (?:our )?\w+ office\b/.test(text)) {
    return "onsite";
  }
  if (/\b(?:fully |100% )?remote\b|\bwork from home\b|\bdistributed team\b/.test(text)) {
    return "remote";
  }
  return null;
}

function detectCanadaEligible(text: string): boolean | null {
  // An explicit US-only restriction is the clearest disqualifying signal.
  if (/\b(?:us|u\.s\.|united states)[- ]only\b|\bmust be (?:located |based )?in the (?:us|united states)\b|\bauthoriz(?:ed|ation) to work in the (?:us|united states)\b|\bus work authorization\b/.test(text)) {
    return false;
  }
  if (/\bcanada\b|\bcanadian\b|\bontario\b|\bgta\b|\btoronto\b|\bbritish columbia\b|\bquebec\b|\balberta\b/.test(text)) {
    return true;
  }
  return null;
}

function detectGtaCommutable(text: string, location: string | null): boolean | null {
  const haystack = location ? norm(location) : text;
  if (GTA_COMMUTABLE.some((city) => haystack.includes(city))) return true;

  // Named a Canadian city outside commuting range — that's a real signal, not
  // an absence of one.
  const outsideGta = [
    "vancouver", "montreal", "calgary", "edmonton", "ottawa", "winnipeg",
    "halifax", "quebec city", "victoria", "saskatoon", "regina", "waterloo",
    "kitchener", "london, on", "hamilton",
  ];
  if (outsideGta.some((city) => haystack.includes(city))) return false;

  return null;
}

function detectTitle(text: string, raw: string): string | null {
  // Prefer an explicit label; fall back to the first line, which is the title
  // in most pasted JDs.
  const labelled = raw.match(/^\s*(?:job\s+)?title\s*[:\-]\s*(.+)$/im);
  if (labelled) return labelled[1].trim();

  const firstLine = raw.split("\n").map((l) => l.trim()).find((l) => l.length > 0);
  if (firstLine && firstLine.length < 120) return firstLine;

  const inline = text.match(/\b((?:senior|staff|lead|principal|group)\s+)?product\s+(?:manager|owner|lead)\b/i);
  return inline ? inline[0] : null;
}

function detectDomainTier(text: string): DomainTier | null {
  // Tier 1 wins ties — a fintech company building developer infrastructure is
  // a dev-tools role first.
  for (const tier of ["tier1", "tier2", "tier3"] as DomainTier[]) {
    if (DOMAIN_TIERS[tier].keywords.some((kw) => text.includes(kw))) return tier;
  }
  return null;
}

function detectEngagement(text: string): Engagement {
  if (/\b(?:contract|contractor|fixed[- ]term|\d+[- ]month contract|freelance|temporary|w2 contract)\b/.test(text)) {
    return "contract";
  }
  if (/\b(?:permanent|full[- ]time|fte|salaried)\b/.test(text)) return "permanent";
  return null;
}

export function extractFields(jdText: string, overrides: ManualOverrides = {}): ExtractedFields {
  const text = norm(jdText);

  const title = overrides.title?.trim() || detectTitle(text, jdText);
  const titleNorm = title ? norm(title) : "";

  const location = overrides.location?.trim() || null;
  const arrangement = overrides.arrangement ?? detectArrangement(text);

  return {
    title,
    location,
    arrangement,
    canadaEligible: detectCanadaEligible(text),
    isGtaCommutable: detectGtaCommutable(text, location),
    // Check the title first, then fall back to the body — plenty of JDs put the
    // real level in the description rather than the header.
    isPmTitle:
      PM_TITLE_MARKERS.some((m) => titleNorm.includes(m)) ||
      PM_TITLE_MARKERS.some((m) => text.includes(m)),
    meetsSeniorityFloor:
      SENIOR_TITLE_MARKERS.some((m) => titleNorm.includes(m)) ||
      (titleNorm === "" && SENIOR_TITLE_MARKERS.some((m) => text.includes(m))),
    domainTier: detectDomainTier(text),
    engagement: detectEngagement(text),
  };
}
