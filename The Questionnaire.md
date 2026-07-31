# The Questionnaire

A running log of questions that come up mid-build but aren't in scope for the moment they're raised. Capture here, don't answer inline, resolve later in a dedicated pass.

Format: question, date raised, status (open / answered), answer + link if resolved.

---

## Open

*(none right now)*

---

## Answered

2. **What goes in the README file in the repo?** — *raised 2026-07-28, answered 2026-07-30.* Written and live at [README.md](README.md). Structure that landed: the failure story in the first screen (problem → why retuning weights wouldn't fix it → the one-line thesis), the plain-text pipeline diagram with CODE/MODEL/HUMAN tags, a gates-vs-weights table, the salary-vs-location contrast as the clarifying case, run instructions, deliberate non-goals, a repo map, and known limits. Deliberately *not* a feature list — an engineer or HM is reading for judgment, so the design decision leads and the setup steps come after.

1. **What is the clear distinction between automation vs. RAG vs. agentic vs. human-in-the-loop in this scorer?** — *raised 2026-07-28, answered 2026-07-28.* See [design-decision.md §3](design-decision.md#3-why-ai-here-at-all--and-what-kind) — gates = pure automation, JD-field extraction = thin model use (finding a fact, not judging it), scoring call = single-shot in-context AI (explicitly *not* RAG, *not* agentic — both rejected on the merits, and the doc says why), reading the shortlist = human-in-the-loop. Also see §2 for the second deterministic boundary: the model returns sub-scores, but code computes the weighted total.
