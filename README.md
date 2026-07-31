# Job-Fit Scorer

I was scoring job postings with a single weighted average over everything — location, salary, domain, seniority, all in one number. It produced **confident wrong answers**: a role in Vancouver that I can't take under any circumstances still scored 7/10, because strong domain and seniority fit pulled the average up over a constraint that should have ended the conversation.

The failure wasn't bad weights. Retuning them wouldn't have fixed it. It was using **one operation for two different kinds of criteria** — a viability question ("is this role possible for me at all?") and a desirability question ("how good is it?") collapsed into the same arithmetic. Averaging is right for the second and a category error for the first.

> **A dealbreaker is a gate. A trade-off is a weight. The bug was averaging the two together.**

This app is that one sentence made literal.

---

## How it works

```
  INPUT
     raw JD text (pasted)
     master resume (read from a local file, gitignored)
        │
        ▼
  [CODE]   EXTRACT gate-relevant fields
        │
        ▼
  [CODE]   THE GATE — four binary checks, before any API call
              1. work arrangement / location
              2. country eligibility
              3. seniority floor (Senior PM and above)
              4. domain / title legitimacy
        │
        ├───────────── fails any one ─────────────┐
        │                                         ▼
        │                                  ✗  DROPPED
        │                                     names which gate · never scored
        │                                     no API call, no tokens spent
        ▼  passes all four
  [MODEL]  ONE scoring call — JD + master resume in the same context
           returns per-dimension sub-scores, resume gaps, rationale
        │
        ▼
  [CODE]   WEIGHTED TOTAL = Σ (sub-score × weight) ÷ Σ weight
           ▲ the model never computes this number
        │
        ▼
  [CODE]   ✓  SCORED — n/10 · band · recommendation + visible breakdown
        │
        ▼
  [HUMAN]  I read it and make the apply / don't-apply call
```

**There are two deterministic boundaries here, not one.** The gate is the obvious one. The second is easy to miss and just as deliberate: the model returns *sub-scores per dimension*, and **code multiplies them by the weights and sums them**. The model never produces the final number — because the original bug lived in the combination step, and handing combination back to a model would put it right back, harder to see.

## What's a gate and what's a weight

| Gates — deterministic, binary, no model | Weights — the model, survivors only |
|---|---|
| Work arrangement / location | Resume fit **(high)** |
| Country eligibility | Domain fit, by tier **(high)** |
| Seniority floor (Senior+) | Engagement type — permanent > contract **(high)** |
| Domain / title legitimacy | Seniority rank, AI/agentic scope **(medium)** |
| | Salary **(deliberately low)**, company stage *(tie-breaker)* |

**Salary is the clarifying case.** I care about salary. It has a real floor. It is weighted *lowest* and is emphatically **not** a gate — because a below-floor number is a negotiation, not an impossibility. Meanwhile location *is* a gate, despite being the thing I'd most like to be flexible about, because no amount of role quality makes a Vancouver office reachable from Whitby.

Strength of feeling doesn't determine gate-vs-weight. Structure does.

## Running it

Requires Node 20+ and an Anthropic API key.

```bash
npm install
```

Add your API key:

```bash
cp .env.example .env.local   # then edit .env.local and paste your key
```

Add your master resume as plain text (this directory is gitignored — it holds personal data and never enters the repo):

```bash
mkdir -p resume && pbpaste > resume/master_resume.txt
```

Start it:

```bash
npm run dev
```

Then open http://localhost:3000. Six fixtures are built in — one per gate that can drop a role, plus three that demonstrate scoring behaviour. The gated fixtures work without a key or a resume, since they return before the model is ever called.

## What this deliberately doesn't do

No company research, no resume tailoring, no live posting verification, no multi-JD sweep, no persistence, no auth. Each of those pulls in a dependency (live web, the tailored-variant library) that would break the property I care about most: **I can rebuild this core loop from scratch in about 45 minutes.** A system I can rebuild is one I actually understand.

## Repo map

| File | What it is |
|---|---|
| [`PRD.md`](PRD.md) | Problem, gates, weights, fixtures, scope boundaries |
| [`design-decision.md`](design-decision.md) | Why AI here at all, where it stays deterministic, how I'd evaluate quality, limits, what changes at scale |
| [`The Questionnaire.md`](The%20Questionnaire.md) | Running log of open questions raised mid-build |
| `lib/gates.ts` | The four gates. Plain code, no model. |
| `lib/score.ts` | The single model call + the weighted arithmetic |
| `lib/config.ts` | Every weight, tier, and threshold in one inspectable place |

## Known limits

Extraction is the weak link — ambiguous JD language can misfeed the gate, so it's tuned to fail toward *passing* a role to scoring rather than dropping it silently (a false drop is invisible and unrecoverable; a false pass costs one API call and one glance). There's no outcome data yet, so scoring quality is calibrated against my own judgment — which is the judgment the tool is meant to improve on. Resume fit is measured against a generic master resume, so it understates fit for roles I'd tailor toward. And the gate encodes today's constraints as permanent: if I'd relocate for an exceptional role, the location gate is wrong and will drop it without telling me.

More detail on all of these — plus the AI-quality metrics and the scale story — in [`design-decision.md`](design-decision.md).
