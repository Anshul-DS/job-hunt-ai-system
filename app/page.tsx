"use client";

import { useState } from "react";
import { FIXTURES } from "@/lib/fixtures";
import type { ExtractedFields } from "@/lib/extract";
import type { GateVerdict } from "@/lib/gates";
import type { ScoreResult } from "@/lib/score";

type ApiResponse =
  | { verdict: "DROPPED"; fields: ExtractedFields; gates: GateVerdict }
  | { verdict: "SCORED"; fields: ExtractedFields; gates: GateVerdict; score: ScoreResult };

export default function Page() {
  const [jdText, setJdText] = useState("");
  const [activeFixture, setActiveFixture] = useState<string | null>(null);
  const [result, setResult] = useState<ApiResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const fixtureNote = FIXTURES.find((f) => f.id === activeFixture)?.expectation;

  async function run() {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/score", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jdText }),
      });
      const data = await res.json();
      if (!res.ok) setError(data.error ?? "Something went wrong.");
      else setResult(data as ApiResponse);
    } catch {
      setError("Could not reach the scorer. Is the dev server still running?");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="wrap">
      <header>
        <h1>Job-Fit Scorer</h1>
        <p className="tagline">
          One job description in, one gated verdict out. Built to make a single design decision
          visible on screen.
        </p>
        <p className="thesis">
          <strong>A dealbreaker is a gate. A trade-off is a weight.</strong> The bug this fixes was
          averaging the two together — which let a role I could never take score a confident 7/10.
        </p>
      </header>

      <div className="cols">
        <div>
          <section className="panel">
            <h2>Job description</h2>
            <textarea
              value={jdText}
              onChange={(e) => {
                setJdText(e.target.value);
                setActiveFixture(null);
              }}
              placeholder="Paste a job posting here…"
              spellCheck={false}
            />
            <div className="row">
              <button onClick={run} disabled={loading || !jdText.trim()}>
                {loading ? "Scoring…" : "Score this role"}
              </button>
              {jdText && (
                <button
                  className="ghost"
                  onClick={() => {
                    setJdText("");
                    setResult(null);
                    setError(null);
                    setActiveFixture(null);
                  }}
                  disabled={loading}
                >
                  Clear
                </button>
              )}
            </div>
          </section>

          {/*
            Collapsed by default: scaffolding, not product. Pasting a real JD is
            the daily path. But they stay one click away because they're also the
            evidence — clicking fixture 1 shows a role that's strong on every
            other axis getting dropped by a gate, which is the claim the README
            makes. Also the regression check when the weights change.
          */}
          <details className="panel fixtures-panel">
            <summary>
              Demo fixtures <span className="count">6 test cases</span>
            </summary>
            <div className="fixtures">
              {FIXTURES.map((f) => (
                <button
                  key={f.id}
                  className="chip"
                  aria-pressed={activeFixture === f.id}
                  disabled={loading}
                  onClick={() => {
                    setJdText(f.jd);
                    setActiveFixture(f.id);
                    setResult(null);
                    setError(null);
                  }}
                >
                  {f.label}
                </button>
              ))}
            </div>
            {fixtureNote && <p className="fixture-note">{fixtureNote}</p>}
          </details>
        </div>

        <div>
          {error && <div className="err">{error}</div>}

          {!result && !error && (
            <section className="panel">
              <p className="placeholder">
                Load a fixture or paste a posting, then score it.
                <br />
                The four gates run in plain code before any model call.
              </p>
            </section>
          )}

          {result && <Trace result={result} />}
        </div>
      </div>
    </div>
  );
}

/**
 * The pipeline trace. Every stage is tagged with who executed it — that tag is
 * the whole point of the screen, not decoration.
 */
function Trace({ result }: { result: ApiResponse }) {
  const dropped = result.verdict === "DROPPED";

  return (
    <>
      <div className={`verdict ${dropped ? "dropped" : "scored"}`}>
        {dropped ? (
          <>
            <h3>DROPPED — {result.gates.droppedBy?.gate}</h3>
            <p>{result.gates.droppedBy?.reason}</p>
            <p style={{ marginTop: ".5rem", opacity: 0.85 }}>
              Never scored, and no API call was made. A dealbreaker filters — it does not get
              averaged against how good the rest of the role looks.
            </p>
          </>
        ) : (
          <div className="score-head">
            <span className="score-num">{result.score.total}</span>
            <span className="score-meta">/ 10</span>
            <span className="score-meta">
              · {result.score.band} · Recommendation: {result.score.recommendation}
            </span>
          </div>
        )}
      </div>

      <section className="panel">
        <h2>Pipeline</h2>

        <div className="stage">
          <span className="tag code">CODE</span>
          <div className="stage-body">
            <div className="stage-title">Extract gate fields</div>
            <div className="stage-detail">
              {result.fields.title ?? "title unreadable"} ·{" "}
              {result.fields.arrangement ?? "arrangement not stated"} ·{" "}
              {result.fields.domainTier ?? "no tier matched"} ·{" "}
              {result.fields.engagement ?? "engagement not stated"}
            </div>
          </div>
        </div>

        <div className="stage">
          <span className="tag code">CODE</span>
          <div className="stage-body">
            <div className="stage-title">The gate — four binary checks</div>
            {result.gates.results.map((g) => (
              <div className="gate-line" key={g.gate}>
                <span className={`mark ${g.passed ? "pass" : "fail"}`}>{g.passed ? "✓" : "✗"}</span>
                <span>
                  <span className="gate-name">{g.gate}</span>{" "}
                  <span className="gate-reason">— {g.reason}</span>
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="stage">
          <span className={`tag ${dropped ? "code" : "model"}`}>{dropped ? "SKIP" : "MODEL"}</span>
          <div className="stage-body">
            <div className="stage-title">
              {dropped ? "Scoring call skipped" : "Scoring call — JD + master resume"}
            </div>
            <div className="stage-detail">
              {dropped
                ? "Gate failed, so no tokens were spent."
                : "One call. Returns per-dimension sub-scores, resume gaps, and rationale — never a total."}
            </div>
          </div>
        </div>

        {!dropped && (
          <div className="stage">
            <span className="tag code">CODE</span>
            <div className="stage-body">
              <div className="stage-title">Weighted total</div>
              <div className="stage-detail">
                Σ (sub-score × weight) ÷ Σ weight — computed here, not by the model.
              </div>
            </div>
          </div>
        )}

        <div className="stage">
          <span className="tag human">HUMAN</span>
          <div className="stage-body">
            <div className="stage-title">You decide</div>
            <div className="stage-detail">
              The scorer ranks and narrows. It never applies to anything.
            </div>
          </div>
        </div>
      </section>

      {result.verdict === "SCORED" && <ScoreDetail score={result.score} />}
    </>
  );
}

function ScoreDetail({ score }: { score: ScoreResult }) {
  const totalWeight = score.subScores.reduce((s, d) => s + d.weight, 0);

  return (
    <>
      <section className="panel">
        <h2>Per-dimension breakdown</h2>
        <table>
          <thead>
            <tr>
              <th>Dimension</th>
              <th className="num">Score</th>
              <th className="num">Weight</th>
            </tr>
          </thead>
          <tbody>
            {score.subScores.map((d) => (
              <tr key={d.key}>
                <td>
                  {d.label}
                  {d.note && <span className="note">{d.note}</span>}
                </td>
                <td className="num">
                  <span className="bar" style={{ width: `${Math.max(d.score, 0.4) * 4}px` }} />
                  {d.score}
                </td>
                <td className="num">{d.weight}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="arith">
          Σ (score × weight) ÷ {totalWeight} = <strong>{score.total}</strong> / 10
        </div>
      </section>

      <section className="panel">
        <h2>Rationale</h2>
        <p style={{ margin: 0, fontSize: ".88rem" }}>{score.rationale}</p>
      </section>

      <section className="panel">
        <h2>Resume gaps</h2>
        {score.resumeGaps.length === 0 ? (
          <p className="empty">No visible gaps against this posting.</p>
        ) : (
          <ul className="gaps">
            {score.resumeGaps.map((g, i) => (
              <li key={i}>
                <span className="wants">{g.jdWants}</span>
                <br />
                <span className="shows">Resume shows: {g.resumeShows}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {score.mustHaves.length > 0 && (
        <section className="panel">
          <h2>Must-haves from the JD</h2>
          <ul className="musts">
            {score.mustHaves.map((m, i) => (
              <li key={i}>{m}</li>
            ))}
          </ul>
        </section>
      )}

      <p className="cost">
        {score.usage.inputTokens.toLocaleString()} in ·{" "}
        {score.usage.outputTokens.toLocaleString()} out · ≈ $
        {score.usage.estimatedCostUsd.toFixed(4)} for this run
      </p>
    </>
  );
}
