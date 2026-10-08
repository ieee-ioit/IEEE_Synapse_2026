"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/components/api";
import { formatDateTime } from "@/lib/format";

type Team = { id: string; teamNumber: number; name: string; email: string; sentAt: string | null };
type Batch = { sent: number[]; failed: { teamNumber: number; error: string }[]; remaining: number };

const BATCH_PAUSE_MS = 1500;

export default function CredentialSender({ teams, enabled }: { teams: Team[]; enabled: boolean }) {
  const router = useRouter();
  const [progress, setProgress] = useState("");
  const [failures, setFailures] = useState<Batch["failed"]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const unsent = teams.filter((t) => !t.sentAt && t.email).length;
  const noEmail = teams.filter((t) => !t.email).length;

  async function sendAll() {
    if (!window.confirm(`Email login codes to ${unsent} team leaders now?`)) return;
    setBusy(true);
    setError("");
    setFailures([]);
    let sent = 0;
    const failed: Batch["failed"] = [];
    const seenFailures = new Set<number>();
    // Batches of 8 with a short pause (gentler on Gmail). Teams that fail are skipped for the rest
    // of the run, so a bad batch never stops the others; they're listed below for a retry.
    for (;;) {
      const res = await api<Batch>("/api/admin/credentials", { skip: [...seenFailures] });
      if (!res.ok) {
        setError(res.error);
        break;
      }
      sent += res.data.sent.length;
      res.data.failed.forEach((f) => !seenFailures.has(f.teamNumber) && (seenFailures.add(f.teamNumber), failed.push(f)));
      setFailures([...failed]);
      setProgress(`Sent ${sent} · failed ${failed.length} · ${Math.max(0, res.data.remaining - failed.length)} remaining`);
      if (res.data.remaining - failed.length <= 0 || (!res.data.sent.length && !res.data.failed.length)) break;
      await new Promise((r) => setTimeout(r, BATCH_PAUSE_MS));
    }
    setBusy(false);
    router.refresh();
  }

  /** CSV of every team without a delivered email, with the error from this session where known. */
  function downloadUnsent() {
    const errors = new Map(failures.map((f) => [f.teamNumber, f.error]));
    const cell = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
    const rows = teams
      .filter((t) => !t.sentAt || errors.has(t.teamNumber))
      .map((t) => [t.teamNumber, t.name, t.email || "(no email)", errors.has(t.teamNumber) ? "failed" : "not sent", errors.get(t.teamNumber) ?? ""]);
    const csv = [["team_number", "team_name", "leader_email", "status", "error"], ...rows].map((r) => r.map(cell).join(",")).join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    a.download = `credentials-not-sent-${new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-")}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  async function resend(team: Team) {
    if (!window.confirm(`Resend the login code to ${team.email}?`)) return;
    setBusy(true);
    const res = await api<Batch>("/api/admin/credentials", { ids: [team.id] });
    setBusy(false);
    if (!res.ok) return setError(res.error);
    setFailures((prev) => [...prev.filter((f) => f.teamNumber !== team.teamNumber), ...res.data.failed]);
    router.refresh();
  }

  return (
    <div className="stack-lg admin-section">
      <div className="row">
        <button type="button" className="btn btn-solid" onClick={sendAll} disabled={!enabled || busy || unsent === 0}>
          {busy ? "Sending…" : unsent ? `Email ${unsent} unsent team${unsent === 1 ? "" : "s"}` : "Everyone has been emailed"}
        </button>
        {progress && <span className="form-note">{progress}</span>}
        {noEmail > 0 && <span className="pill pill--warn">{noEmail} without a leader email</span>}
        <span className="spacer" />
        <button type="button" className="btn btn-ghost btn-sm" onClick={downloadUnsent} disabled={busy || (unsent === 0 && failures.length === 0)}>
          Download failures / not sent (CSV)
        </button>
      </div>
      {error && <div className="notice notice--bad">{error}</div>}
      {failures.length > 0 && (
        <div className="notice notice--bad">
          <div style={{ fontWeight: 500, marginBottom: 4 }}>
            {failures.length} failed. Fix the address if needed, then use Send on that team.
          </div>
          {failures.map((f) => (
            <div key={f.teamNumber}>
              Team {f.teamNumber}: {f.error}
            </div>
          ))}
        </div>
      )}
      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>#</th>
              <th>Team</th>
              <th>Leader email</th>
              <th>Emailed</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {teams.map((t) => (
              <tr key={t.id}>
                <td className="mono">{t.teamNumber}</td>
                <td>{t.name}</td>
                <td>{t.email || <span className="muted">—</span>}</td>
                <td>{t.sentAt ? <span className="pill pill--ok">{formatDateTime(t.sentAt)}</span> : <span className="pill pill--idle">not yet</span>}</td>
                <td className="num">
                  {t.email && (
                    <button type="button" className="btn btn-ghost btn-sm" disabled={!enabled || busy} onClick={() => resend(t)}>
                      {t.sentAt ? "Resend" : "Send"}
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {!teams.length && (
              <tr>
                <td colSpan={5} className="muted">
                  No teams yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
