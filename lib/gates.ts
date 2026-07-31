/**
 * THE GATE — four binary checks, plain code, no model, no API spend.
 *
 * This file is the whole argument of the project. A dealbreaker filters; a
 * trade-off weights. Averaging the two together is what produced confident
 * wrong answers, so the two operations live in different files and run in a
 * fixed order: fail here and nothing is ever scored.
 *
 * Failure direction is deliberate (design-decision.md §5): a false drop is
 * silent and unrecoverable, a false pass costs one API call and one glance.
 * So an *unknown* field never drops a role — only a positive disqualifying
 * signal does. When unsure, let the human see it.
 */

import type { ExtractedFields } from "./extract";

export type GateName =
  | "Work arrangement / location"
  | "Country eligibility"
  | "Seniority floor"
  | "Domain / title legitimacy";

export interface GateResult {
  gate: GateName;
  passed: boolean;
  reason: string;
}

export interface GateVerdict {
  passed: boolean;
  results: GateResult[];
  /** Populated only on failure — the gate that dropped it, and why. */
  droppedBy?: GateResult;
}

function checkLocation(f: ExtractedFields): GateResult {
  const gate: GateName = "Work arrangement / location";

  if (f.arrangement === "remote") {
    return { gate, passed: true, reason: "Fully remote." };
  }

  if (f.arrangement === "onsite" || f.arrangement === "hybrid") {
    if (f.isGtaCommutable === true) {
      return {
        gate,
        passed: true,
        reason: `${f.arrangement === "onsite" ? "Onsite" : "Hybrid"} within GTA commuting range${f.location ? ` (${f.location})` : ""}.`,
      };
    }
    if (f.isGtaCommutable === false) {
      return {
        gate,
        passed: false,
        reason: `${f.arrangement === "onsite" ? "Onsite" : "Hybrid"} outside GTA commuting range${f.location ? ` (${f.location})` : ""}. No relocation.`,
      };
    }
    // Arrangement requires presence but the location is unreadable. Pass it
    // through rather than guess — a human can see it in one glance.
    return {
      gate,
      passed: true,
      reason: `${f.arrangement === "onsite" ? "Onsite" : "Hybrid"} but location unclear — passed for human review rather than dropped.`,
    };
  }

  return { gate, passed: true, reason: "Work arrangement not stated — passed for human review." };
}

function checkCountry(f: ExtractedFields): GateResult {
  const gate: GateName = "Country eligibility";

  if (f.canadaEligible === false) {
    return { gate, passed: false, reason: "US-only or requires US work authorization." };
  }
  if (f.canadaEligible === true) {
    return { gate, passed: true, reason: "Canada-based or Canada-remote-eligible." };
  }
  return { gate, passed: true, reason: "Country eligibility not stated — passed for human review." };
}

function checkSeniority(f: ExtractedFields): GateResult {
  const gate: GateName = "Seniority floor";

  if (f.meetsSeniorityFloor) {
    return { gate, passed: true, reason: `Senior or above${f.title ? ` — "${f.title}"` : ""}.` };
  }
  return {
    gate,
    passed: false,
    reason: `Below the Senior floor${f.title ? ` — "${f.title}"` : ""}. Senior / Staff / Lead / Principal PM only.`,
  };
}

function checkDomain(f: ExtractedFields): GateResult {
  const gate: GateName = "Domain / title legitimacy";

  if (!f.isPmTitle) {
    return {
      gate,
      passed: false,
      reason: `Not a product management role${f.title ? ` — "${f.title}"` : ""}.`,
    };
  }
  if (f.domainTier === null) {
    return {
      gate,
      passed: false,
      reason: "Industry outside Tier 1/2/3 (B2B SaaS & dev tools, analytics & AI platforms, fintech).",
    };
  }
  return { gate, passed: true, reason: `PM role in a Tier ${f.domainTier.slice(-1)} industry.` };
}

/**
 * Runs every gate rather than short-circuiting on the first failure — seeing
 * all four verdicts is more useful than seeing the first one that tripped, and
 * costs nothing at this scale.
 */
export function runGates(fields: ExtractedFields): GateVerdict {
  const results = [
    checkLocation(fields),
    checkCountry(fields),
    checkSeniority(fields),
    checkDomain(fields),
  ];

  const droppedBy = results.find((r) => !r.passed);
  return { passed: !droppedBy, results, droppedBy };
}
