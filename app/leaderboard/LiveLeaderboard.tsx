"use client";

import { useEffect, useState } from "react";
import { useLiveVersion } from "@/components/useLiveVersion";
import { formatScore, formatTime } from "@/lib/format";

type Row = {
  rank: number | null;
  teamNumber: number;
  name: string;
  status: "building" | "submitted";
  submittedAt: string | null;
  score?: number | null;
  repoUrl?: string | null;
  demoVideoUrl?: string | null;
  isFinalist?: boolean;
};

type Data =
  | { visible: false }
  | { visible: true; scoresVisible: boolean; teams: Row[]; totals: { teams: number; submitted: number } };

export default function LiveLeaderboard() {
  const { version, mode } = useLiveVersion();
  const [data, setData] = useState<Data | null>(null);
  const [failed, setFailed] = useState(false);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    let retry: ReturnType<typeof setTimeout> | undefined;
    const v = attempt ? `${version}-r${attempt}` : version;
    fetch(`/api/leaderboard${v ? `?v=${encodeURIComponent(v)}` : ""}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((d: Data) => {
        if (cancelled) return;
        setData(d);
        setFailed(false);
        setUpdatedAt(new Date().toISOString());
      })
      .catch(() => {
        if (cancelled) return;
        setFailed(true);
        retry = setTimeout(() => setAttempt((n) => n + 1), 10_000);
      });
    return () => {
      cancelled = true;
      clearTimeout(retry);
    };
  }, [version, attempt]);

  if (!data) {
    return (
      <div className="panel board-empty" style={{ marginTop: 48 }}>
        <p>{failed ? "Couldn’t reach the leaderboard. Retrying automatically…" : "Loading the leaderboard…"}</p>
      </div>
    );
  }

  if (!data.visible) {
    return (
      <div className="panel board-empty" style={{ marginTop: 48, textAlign: "center", padding: "48px 24px" }}>
        <h2 className="page-title">
          Results at <em>5:30 PM</em>
        </h2>
        <p style={{ maxWidth: 480, margin: "12px auto 0", color: "var(--muted)" }}>
          The grand leaderboard will be revealed after Stage 2 live demos and final judging at 05:30 PM IST. Keep this page open — it will go live automatically!
        </p>
      </div>
    );
  }

  const { teams, scoresVisible, totals } = data;
  const top3 = teams.filter((t) => t.rank && t.rank <= 3).sort((a, b) => (a.rank ?? 0) - (b.rank ?? 0));
  const otherFinalists = teams.filter((t) => !t.rank || t.rank > 3);

  return (
    <>
      <div className="board-head">
        <div className="board-meta">
          <span className={`pill ${mode === "live" ? "pill--ok pill--live" : "pill--idle"}`}>
            {mode === "live" ? "Live" : mode === "polling" ? "Auto-refresh" : "Connecting"}
          </span>
          {updatedAt && <span className="mono">Updated {formatTime(updatedAt)}</span>}
          {failed && <span className="pill pill--warn">Reconnecting</span>}
        </div>
        <div className="board-meta">
          <span className="mono">
            {totals.submitted}/{totals.teams}
          </span>
          submitted
        </div>
      </div>

      {teams.length === 0 ? (
        <div className="panel board-empty">
          <p>No finalists published yet.</p>
        </div>
      ) : (
        <>
          {/* Podium Display */}
          {top3.length > 0 && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 16, margin: "24px 0 32px" }}>
              {top3.map((t) => (
                <div
                  key={t.teamNumber}
                  className="panel"
                  style={{
                    border: t.rank === 1 ? "2px solid #eab308" : t.rank === 2 ? "2px solid #94a3b8" : "2px solid #d97706",
                    background: t.rank === 1 ? "rgba(234, 179, 8, 0.05)" : "rgba(255, 255, 255, 0.02)",
                    borderRadius: 12,
                    padding: 20,
                    textAlign: "center",
                  }}
                >
                  <div style={{ fontSize: 32, marginBottom: 8 }}>
                    {t.rank === 1 ? "🥇 Winner" : t.rank === 2 ? "🥈 Runner-up" : "🥉 2nd Runner-up"}
                  </div>
                  <div style={{ fontSize: 20, fontWeight: 700, margin: "4px 0" }}>{t.name}</div>
                  <div className="mono muted" style={{ fontSize: 13, marginBottom: 12 }}>Team #{t.teamNumber}</div>
                  
                  {scoresVisible && t.score != null && (
                    <div className="mono" style={{ fontSize: 24, fontWeight: 600, color: "var(--fg)" }}>
                      {formatScore(t.score)} <span style={{ fontSize: 14, color: "var(--muted)" }}>/ 10</span>
                    </div>
                  )}

                  <div className="row" style={{ justifyContent: "center", gap: 12, marginTop: 12 }}>
                    {t.repoUrl && (
                      <a href={t.repoUrl} target="_blank" rel="noopener noreferrer" className="btn btn-ghost btn-sm">
                        Repository
                      </a>
                    )}
                    {t.demoVideoUrl && (
                      <a href={t.demoVideoUrl} target="_blank" rel="noopener noreferrer" className="btn btn-ghost btn-sm">
                        Demo Video
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Top Finalists List */}
          {otherFinalists.length > 0 && (
            <div style={{ marginTop: 24 }}>
              <h3 style={{ fontSize: 18, marginBottom: 12, fontWeight: 600 }}>Top Finalists</h3>
              <ol className="board">
                {otherFinalists.map((t, i) => (
                  <li
                    key={t.teamNumber}
                    className="board-row"
                    style={{ animationDelay: `${Math.min(i, 12) * 40}ms` }}
                  >
                    <span className="board-rank">
                      {t.rank ? String(t.rank).padStart(2, "0") : "—"}
                    </span>
                    <div style={{ minWidth: 0 }}>
                      <div className="board-name">{t.name}</div>
                      <div className="board-sub mono">Team #{t.teamNumber}</div>
                    </div>
                    <div className="board-score">
                      {scoresVisible && t.score != null ? (
                        <>
                          {formatScore(t.score ?? null)}
                          <small>/10</small>
                          <div className="score-bar" aria-hidden="true">
                            <span style={{ width: `${((t.score ?? 0) / 10) * 100}%` }} />
                          </div>
                        </>
                      ) : (
                        <span className="muted" style={{ fontSize: 14 }}>
                          {t.rank ? "Finalist" : "Awaiting score"}
                        </span>
                      )}
                    </div>
                    <div className="board-status">
                      {t.demoVideoUrl && (
                        <a href={t.demoVideoUrl} target="_blank" rel="noopener noreferrer" style={{ fontSize: 13, textDecoration: "underline" }}>
                          Watch video
                        </a>
                      )}
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          )}
        </>
      )}
    </>
  );
}
