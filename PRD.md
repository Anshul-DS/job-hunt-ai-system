# PRD: Job-Fit Scorer (Slice)

Status: skeleton — decisions below are drafted, not final. Flag anything that should change before build starts.

## 1. Problem

Ansh currently applies one weighted score across everything — hard constraints (location, country eligibility) and soft preferences (salary, domain, seniority) get averaged together into a single number. This produces a **confident wrong answer**: a role that should be dropped outright (e.g. onsite outside GTA) can still surface with a decent score because strong domain fit or seniority match drags the average up.

The fix is structural, not cosmetic: a dealbreaker must **filter**, a trade-off must **weight**. Those are different operations and the current system doesn't separate them.

## 2. User & JTBD

**User:** Ansh only. Not building for multi-user use.

**Job to be done:** "When I have a new JD, I want a fast, structural fit read — gated first, scored second — so I stop wasting evaluation time on roles that were never viable, and so the roles that remain are ranked on preferences that actually should trade off against each other."

## 3. Core loop

1. Paste raw JD text (+ optional structured fields: title, company, location/arrangement, salary). Master resume is read automatically from a fixed local file — no per-JD upload step (see §5, §10).
2. Extract gate-relevant fields (arrangement, location, title) — heuristic or a light model call.
3. Apply deterministic gates in code. Fail any gate → **DROPPED**, never scored.
4. Survivors go to one model call (JD + master resume together) → per-dimension sub-scores, including resume fit, + weighted total + rationale.
5. Output: gated/ranked shortlist.

One JD in → one gated fit verdict out. That's the whole boundary for this slice.

## 4. Gates — deterministic, binary, no model

Run in plain code, before any API call. Four gates, not two — the last two were added specifically to keep a future automated-scraping feed from flooding the AI layer with noise (irrelevant titles/industries), even though today, with Ansh hand-pasting one JD at a time, they never actually trigger.

| Gate | Pass | Drop |
|---|---|---|
| Work arrangement / location | Fully remote + Canada-eligible, OR onsite/hybrid within GTA commuting range (Toronto, Markham, Scarborough, Pickering, Ajax, Whitby, Oshawa, North York, Vaughan, Richmond Hill — adjustable list) | Onsite/hybrid outside that range. No relocation. |
| Country eligibility | Canada-based or Canada-remote-eligible | US-only / US-onsite |
| Seniority / title floor | Senior PM and above (Senior/Staff/Lead/Principal PM, Product Lead) | Below Senior (plain PM, Associate PM, etc.) |
| Domain / title legitimacy | Genuine PM/product-lead title, in an industry within Tier 1, 2, or 3 (see §5) | Non-PM titles, or industries outside all three tiers — this is the noise filter |

**Not a gate:** engagement type and salary. Both are real, standing preferences now, but neither should ever silently drop a role — they only rank survivors (§5). This is the same distinction the whole slice is built to demonstrate: a dimension you feel strongly about isn't automatically a gate.

**Design note for later:** Ansh has flagged that Seniority and Domain floor becoming configurable gates (vs. hardcoded) is a v2 direction, and Salary may eventually become a hard constraint too. Not now — noted here so the design-decision doc's "what changes at scale" section has somewhere to point.

## 5. Weighted score — AI layer, survivors only

| Dimension | Weight | Notes |
|---|---|---|
| Resume fit | High | Model reads the master resume alongside the JD in the same call and returns a resume-match sub-score plus a short itemized list of gaps (e.g. "JD wants X, resume shows Y instead"). This is the dimension the original slice was missing — without it, the score reflected only generic JD-side aspects, never whether *his* resume actually supports the case. |
| Domain fit (tier ranking) | High | The gate already confirmed the role is in Tier 1/2/3 — this re-ranks *among* survivors: Tier 1 (enterprise B2B SaaS, dev tools/DevEx) > Tier 2 (analytics, AI/data platforms) > Tier 3 (fintech). Domain fit is deliberately dual-role: coarse pass/fail at the gate, fine-grained ranking in the score. |
| Engagement type | High | Permanent scores higher than contract — a real, standing preference, independent of what he's actively pursuing at any given moment. |
| Seniority rank | Medium | Secondary differentiation *among* Senior/Staff/Lead/Principal PM — everyone here already cleared the seniority gate; this ranks how far above the floor they are. |
| AI / agentic content in the role | Medium | Positioning bet — agentic/AI scope lifts the score. |
| Salary | Low (deliberate) | This is the exact preference that caused the original averaging bug — weight stays low so it can never dominate the total, even though engagement type and domain now sit at High. Missing salary ≠ penalty. Reference floor: CAD 140,000 (carried over from existing analyzer; informs sub-score, not a gate). |
| Company stage / size | Low / optional | Tie-breaker only. |

Weights are **explicit and inspectable in the output** — that's the point of the slice, not a nice-to-have.

Worth flagging directly: Salary staying deliberately Low while Engagement type and Domain sit at High is not an oversight — it's the one dimension explicitly kept low *on purpose*, because it's the exact preference that got wrongly averaged against a gate in the original failure story. Raising it now would quietly undo the thing this project exists to fix.

## 6. Input / output shape

**Input (MVP):** raw JD text, one screen, plus optional structured fields (title, company, location/arrangement, salary).

**Output vocabulary — reused from the existing analyzer, not invented:**

- `DROPPED — <which gate, why>` (gate failures never get a score), OR
- `SCORED`:
  - Fit score **/10**
  - Fit rating band: **Strong / Competitive / Stretch**
  - Recommendation: **Yes / Maybe / No**
  - Per-dimension breakdown (visible, not just the total)
  - Resume-fit gaps: short itemized list (e.g. "JD wants X, resume shows Y instead") — not a full tailoring pass, just what's visibly missing
  - 2–3 sentence rationale

**Decided — scoring scale cutoffs:**

| Score | Band | Recommendation |
|---|---|---|
| 8–10 | Strong | Yes |
| 5–7 | Competitive | Maybe |
| 1–4 | Stretch | No |

Note: the existing analyzer's full band set is Strong / Competitive / Stretch / **Misaligned**. Misaligned drops out of the scorer's vocabulary entirely — those cases are now caught by the gate before scoring, not by a low score. That collapse (4 bands → 3) is itself a small piece of evidence the gate is doing real work; worth a line in the design-decision doc.

**Optional, cheap add:** top must-haves extracted from the JD, folded into the same model call as supporting context. Include only if it doesn't slow the core loop — cut if it does.

## 7. Sample fixtures (build/test against, no JD-hunting mid-build)

Five fixtures now — one per gate that can drop a role, plus two that demonstrate scoring behavior on survivors.

1. **Gated out — location:** Senior PM, strong domain, onsite in Vancouver → DROPPED at location gate.
2. **Gated out — seniority:** plain "Product Manager" (below Senior), otherwise strong domain/remote-Canada → DROPPED at seniority gate.
3. **Gated out — domain/title noise:** non-PM title or industry outside Tier 1/2/3 (e.g. a scraped "Sales Manager" or "Nurse" posting) → DROPPED at domain/title legitimacy gate. Proves the noise filter works before any future scraping automation exists.
4. **Strong match:** Staff PM, dev-tools/enterprise SaaS, remote Canada, agentic scope, permanent → survives all four gates, scores high (Tier 1 domain, high engagement-type weight, seniority rank above floor).
5. **Survives-but-low:** Senior PM, fintech, remote Canada, low salary, contract → survives all four gates (fintech is Tier 3, still passes), scores lower on domain tier and engagement type; salary's deliberately low weight keeps it from dragging the total down further than it should. This is the fixture that specifically demonstrates the original bug is fixed.
6. **Resume mismatch:** survives all four gates with strong domain/seniority/engagement match on the JD side, but the master resume doesn't visibly cover the JD's core requirements → resume-fit sub-score low, itemized gaps populated, pulls the overall score down despite everything else looking strong. This is the fixture that proves resume fit isn't decorative — it can move the outcome on its own.

All fixtures are evaluated against the same fixed master resume (§5, §10) — only the JD varies.

## 8. Out of scope

Each of these needs a dependency that breaks "rebuildable in 45 min, no external deps":

- Company background research (needs live web)
- Resume tailoring / docx output, and multi-resume-variant selection (needs the full variant library, not just the master resume)
- Live title verification (needs web fetch) — optional v2
- Multi-JD sweep, ATS parsing, persistence/DB, auth, deployment

**Revised from the original scope call:** a holistic resume-fit sub-score + itemized gap list (§5, §6) is now **in scope** — it only needs the master resume loaded once, not the resume + variant library + tailoring logic. What's still out: rewriting the resume, picking among tailored variants, or producing any output file.

## 9. Sprint deliverable criteria

These are about whether the *build* succeeded — not a claim about the scorer's real-world accuracy at picking good jobs, which needs outcome history this sprint doesn't have time to accumulate. Longer-horizon scorer quality (precision/recall, false-negative cost, rationale-quality eval) belongs in the design-decision doc's AI-quality-metrics section, not here.

- All 6 fixtures produce the expected gate/score behavior end-to-end on his laptop.
- He can rebuild the core loop from scratch in ~45 minutes.
- README + PRD + design-decision doc are presentable to an engineer or HM without narration.
- The gate-then-score split is visible on screen, not just in code comments.

## 10. Security

- API key loads from `.env`; `.env` in `.gitignore` from commit #1.
- Master resume loads from a fixed local file (e.g. `resume/master_resume.txt`); that file (and the whole `resume/` directory) is also `.gitignore`'d from commit #1 — it's personal data (name, contact info, employer history), not just a secret key, and the same "this repo goes public" rule applies even harder.
- Confirm both before commit #1.

## 11. Next artifact

Design-decision doc (not this doc): why AI here at all, where it's deterministic and why, how output quality gets evaluated, known limitations, what changes at scale. Not started yet.
