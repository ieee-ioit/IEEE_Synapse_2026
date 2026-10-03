"use client";

import { useEffect, useState } from "react";
import { api } from "@/components/api";
import { formatClock, formatLong, useNow } from "@/components/Countdown";
import { Sparkle } from "@/components/icons";
import { useLiveVersion } from "@/components/useLiveVersion";
import { event } from "@/lib/event";
import { formatDateTime, formatScore, formatTime } from "@/lib/format";
import type { TeamView } from "@/lib/team";

const STATUS = {
  building: { label: "Building", cls: "pill--warn" },
  submitted: { label: "Submitted", cls: "pill--ok" },
  disqualified: { label: "Disqualified", cls: "pill--bad" },
} as const;

export default function TeamDashboard({ initial }: { initial: TeamView }) {
  const [view, setView] = useState(initial);
  const [repo, setRepo] = useState(initial.team.repoUrl ?? "");
  const [video, setVideo] = useState(initial.team.demoVideoUrl ?? "");
  const [msg, setMsg] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [busy, setBusy] = useState<"" | "saveRepo" | "saveVideo" | "submit">("");
  const { version } = useLiveVersion();
  const now = useNow();

  // Leaderboard published / scores changed → refresh our own result.
  useEffect(() => {
    if (!version) return;
    fetch("/api/team/me", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((v: TeamView | null) => v && setView(v));
  }, [version]);

  const { team, result } = view;
  const start = Date.parse(view.eventStart);
  const deadline = Date.parse(view.deadline);
  const closed = now != null && now >= deadline;
  const locked = team.status === "disqualified" || closed;
  const savedRepo = team.repoUrl ?? "";
  const savedVideo = team.demoVideoUrl ?? "";

  // Video unlocks after hour 4 (4 hours after build starts) or if already saved
  const videoUnlocked = Boolean(
    savedVideo || (now != null && now >= start + 4 * 60 * 60 * 1000) || closed
  );

  async function saveRepo() {
    setBusy("saveRepo");
    setMsg(null);
    const res = await api<{ url: string }>("/api/team/repo", { url: repo });
    setBusy("");
    if (!res.ok) return setMsg({ kind: "error", text: res.error });
    setRepo(res.data.url);
    setView((v) => ({ ...v, team: { ...v.team, repoUrl: res.data.url } }));
    setMsg({ kind: "ok", text: "GitHub repository link saved." });
  }

  async function saveVideo() {
    setBusy("saveVideo");
    setMsg(null);
    const res = await api<{ url: string }>("/api/team/video", { url: video });
    setBusy("");
    if (!res.ok) return setMsg({ kind: "error", text: res.error });
    setVideo(res.data.url);
    setView((v) => ({ ...v, team: { ...v.team, demoVideoUrl: res.data.url } }));
    setMsg({ kind: "ok", text: "Demo video link saved." });
  }

  async function submit() {
    if (!window.confirm("Submit your project? You can still update your links anytime before 03:00 PM.")) return;
    setBusy("submit");
    setMsg(null);
    const res = await api<{ submittedAt: string }>("/api/team/submit");
    setBusy("");
    if (!res.ok) return setMsg({ kind: "error", text: res.error });
    setView((v) => ({ ...v, team: { ...v.team, status: "submitted", submittedAt: res.data.submittedAt } }));
    setMsg({ kind: "ok", text: `Submitted at ${formatTime(res.data.submittedAt)}. Nice work!` });
  }

  let clockLabel = "Submissions close in";
  let clockValue = "—";
  if (now != null) {
    if (now < start) {
      clockLabel = "Build starts in";
      clockValue = formatLong(start - now);
    } else if (now < deadline) {
      clockValue = formatClock(deadline - now);
    } else {
      clockLabel = "Submissions";
      clockValue = "Closed";
    }
  }

  return (
    <>
      <div className="page-head">
        <span className="badge">
          <Sparkle />
          Team #{team.teamNumber}
        </span>
        <h1 className="page-title">
          Hey, <em>{team.name}</em>
        </h1>
        <p className="page-lede">
          Save your GitHub repo and demo video links. Edit them anytime before the 03:00 PM deadline.
        </p>
      </div>

      <div className="dash">
        <section className="panel span-4">
          <div className="panel-title">Status</div>
          <span className={`pill ${STATUS[team.status].cls}`}>{STATUS[team.status].label}</span>
          <p className="form-note" style={{ marginTop: 12 }}>
            {team.submittedAt ? (
              <>
                Submitted <span className="mono">{formatDateTime(team.submittedAt)}</span>
              </>
            ) : team.status === "disqualified" ? (
              "Talk to an organizer if you think this is a mistake."
            ) : (
              "In progress (building)."
            )}
          </p>
        </section>

        <section className="panel span-8">
          <div className="panel-title">
            {clockLabel}
            <span className="mono">Deadline {formatDateTime(view.deadline)}</span>
          </div>
          <div className="big-number mono">{clockValue}</div>
        </section>

        <section className="panel span-7">
          <div className="panel-title">Deliverables</div>
          <div className="stack">
            {/* Repo input */}
            <div>
              <label style={{ display: "block", fontSize: 13, marginBottom: 6, fontWeight: 500 }}>
                GitHub Repository URL (Private)
              </label>
              <div style={{ display: "flex", gap: 8 }}>
                <input
                  className="input mono"
                  value={repo}
                  onChange={(e) => setRepo(e.target.value)}
                  placeholder="https://github.com/your-team/project"
                  disabled={locked}
                  aria-label="GitHub repo URL"
                  spellCheck={false}
                />
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={saveRepo}
                  disabled={locked || busy !== "" || !repo.trim() || repo.trim() === savedRepo}
                >
                  {busy === "saveRepo" ? "Saving…" : "Save"}
                </button>
              </div>
              <p className="form-note" style={{ marginTop: 4 }}>
                Add <span className="code-chip">{event.reviewerGithub}</span> as collaborator on GitHub.
              </p>
            </div>

            {/* Video input */}
            <div style={{ marginTop: 12 }}>
              <label style={{ display: "block", fontSize: 13, marginBottom: 6, fontWeight: 500 }}>
                Demo Video Link (Mandatory)
              </label>
              {videoUnlocked ? (
                <>
                  <div style={{ display: "flex", gap: 8 }}>
                    <input
                      className="input mono"
                      value={video}
                      onChange={(e) => setVideo(e.target.value)}
                      placeholder="https://youtu.be/... or Google Drive / Loom"
                      disabled={locked}
                      aria-label="Demo video URL"
                      spellCheck={false}
                    />
                    <button
                      type="button"
                      className="btn btn-ghost"
                      onClick={saveVideo}
                      disabled={locked || busy !== "" || !video.trim() || video.trim() === savedVideo}
                    >
                      {busy === "saveVideo" ? "Saving…" : "Save"}
                    </button>
                  </div>
                  <p className="form-note" style={{ marginTop: 4 }}>
                    Allowed hosts: {event.allowedVideoHosts.join(", ")}
                  </p>
                </>
              ) : (
                <div className="panel board-empty" style={{ padding: 12 }}>
                  <p className="form-note" style={{ margin: 0 }}>
                    Demo video submission opens at Hour 4 (01:00 PM). Focus on your repo first!
                  </p>
                </div>
              )}
            </div>

            {/* Final Submit action */}
            <div style={{ marginTop: 14, paddingTop: 14, borderTop: "1px solid var(--line)" }}>
              <div className="row-between">
                <button
                  type="button"
                  className="btn btn-solid"
                  onClick={submit}
                  disabled={locked || busy !== "" || !savedRepo}
                >
                  {busy === "submit" ? "Submitting…" : team.status === "submitted" ? "Update submission" : "Submit project"}
                </button>
                {team.status === "submitted" && (
                  <span className="pill pill--ok">Locked for evaluation at 15:00</span>
                )}
              </div>
              {msg && (
                <p className={msg.kind === "ok" ? "form-ok" : "form-error"} style={{ marginTop: 10 }} role="status">
                  {msg.text}
                </p>
              )}
            </div>
          </div>
        </section>

        <section className="panel span-5">
          <div className="panel-title">Your results</div>
          {result ? (
            result.rank ? (
              <>
                <div className="big-number">
                  #{result.rank} <small>of {result.ranked}</small>
                </div>
                {"score" in result && (
                  <div style={{ marginTop: 10 }}>
                    <p style={{ fontWeight: 600, margin: "0 0 6px" }}>
                      Score: <span className="mono">{formatScore(result.score ?? null)}</span> / 10
                    </p>
                    {result.criteriaScores && result.criteriaScores.length > 0 && (
                      <div style={{ fontSize: 13, borderTop: "1px solid var(--line)", paddingTop: 8 }}>
                        <div style={{ fontWeight: 500, marginBottom: 4 }}>Criterion Breakdown:</div>
                        <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
                          {result.criteriaScores.map((cs) => (
                            <li key={cs.criterionId} className="row-between" style={{ padding: "2px 0" }}>
                              <span className="muted">{cs.name} ({cs.weight}%):</span>
                              <span className="mono">{cs.score} / 10</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
              </>
            ) : (
              <p className="form-note">The leaderboard is live, but your team has not been scored yet.</p>
            )
          ) : (
            <p className="form-note">Your rank and score breakdown will appear here privately once organizers publish the results.</p>
          )}
        </section>

        <section className="panel span-12">
          <div className="panel-title">Team</div>
          <dl className="kv">
            <dt>Leader</dt>
            <dd>
              {team.leaderName || "—"}
              {team.leaderEmail && <span className="muted"> · {team.leaderEmail}</span>}
            </dd>
            {team.college && (
              <>
                <dt>College</dt>
                <dd>{team.college}</dd>
              </>
            )}
            <dt>Members</dt>
            <dd>{view.members.length ? view.members.map((m) => m.name).join(", ") : "—"}</dd>
          </dl>
        </section>
      </div>
    </>
  );
}
