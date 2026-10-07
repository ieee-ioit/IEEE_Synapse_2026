"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { api } from "@/components/api";
import { formatScore } from "@/lib/format";
import type { FinalistCandidate } from "@/lib/finalists";

type Props = {
  candidates: FinalistCandidate[];
  finalistCount: number;
  criteriaCount: number;
  stage2Locked: boolean;
  tiedAtCutoff: string[];
};

/**
 * Suggests the Stage 1 top N; organizers can swap teams before confirming. Teams tied at the
 * cut-off are left for a manual choice.
 */
export default function FinalistsPanel({ candidates, finalistCount, criteriaCount, stage2Locked, tiedAtCutoff }: Props) {
  const router = useRouter();
  const tied = useMemo(() => new Set(tiedAtCutoff), [tiedAtCutoff]);
  const current = candidates.filter((c) => c.isFinalist).map((c) => c.id);
  const suggested = candidates.slice(0, finalistCount).filter((c) => !tied.has(c.id)).map((c) => c.id);
  const [selected, setSelected] = useState<Set<string>>(new Set(current.length ? current : suggested));
  const [confirmIncomplete, setConfirmIncomplete] = useState(false);
  const [confirmTie, setConfirmTie] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "error"; text: string } | null>(null);

  const chosen = candidates.filter((c) => selected.has(c.id));
  const incomplete = chosen.filter((c) => c.criteriaScored < criteriaCount);
  const toggle = (id: string) =>
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  async function save() {
    setBusy(true);
    setMsg(null);
    const res = await api<{ teamNumbers: number[] }>("/api/admin/teams", {
      action: "set-finalists",
      ids: [...selected],
      confirmIncomplete,
      confirmTie,
    });
    setBusy(false);
    if (!res.ok) return setMsg({ kind: "error", text: res.error });
    setMsg({ kind: "ok", text: `Finalists saved: ${res.data.teamNumbers.join(", ")}.` });
    setConfirmed(false);
    router.refresh();
  }

  if (!candidates.length) return <p className="form-note">Import Stage 1 scores first. The finalists are chosen from the Stage 1 ranking.</p>;

  return (
    <div className="stack">
      {stage2Locked && <div className="notice">Stage 2 scores exist, so the finalists are locked.</div>}
      {tied.size > 0 && (
        <div className="notice">
          {tied.size} teams are tied at the cut-off (rank {finalistCount}). They aren&rsquo;t pre-selected: choose between them.
        </div>
      )}
      <div className="table-wrap" style={{ maxHeight: 420, overflow: "auto" }}>
        <table className="table">
          <thead>
            <tr>
              <th />
              <th>Rank</th>
              <th>Team</th>
              <th className="num">Stage 1</th>
            </tr>
          </thead>
          <tbody>
            {candidates.map((c) => (
              <tr key={c.id}>
                <td>
                  <input type="checkbox" checked={selected.has(c.id)} disabled={stage2Locked} onChange={() => toggle(c.id)} aria-label={`Finalist: team ${c.teamNumber}`} />
                </td>
                <td className="mono">{c.rank}</td>
                <td>
                  <span className="mono muted">#{c.teamNumber}</span> {c.name}
                  {tied.has(c.id) && <span className="pill pill--warn" style={{ marginLeft: 6 }}>tied at cut-off</span>}
                  {c.criteriaScored < criteriaCount && (
                    <span className="pill pill--warn" style={{ marginLeft: 6 }}>
                      incomplete: {c.criteriaScored} of {criteriaCount} criteria
                    </span>
                  )}
                </td>
                <td className="num mono">{formatScore(c.score)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className={selected.size === finalistCount ? "form-note" : "form-error"}>
        {selected.size} of {finalistCount} selected.
      </p>
      {incomplete.length > 0 && (
        <label className="switch" style={{ fontSize: 13.5 }}>
          <input type="checkbox" checked={confirmIncomplete} onChange={(e) => setConfirmIncomplete(e.target.checked)} />
          <span className="switch-track" />
          Include {incomplete.length} team(s) with incomplete Stage 1 marks
        </label>
      )}
      {tied.size > 0 && (
        <label className="switch" style={{ fontSize: 13.5 }}>
          <input type="checkbox" checked={confirmTie} onChange={(e) => setConfirmTie(e.target.checked)} />
          <span className="switch-track" />
          I&rsquo;ve chosen between the tied teams
        </label>
      )}
      <label className="switch" style={{ fontSize: 13.5 }}>
        <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} />
        <span className="switch-track" />
        These are the {finalistCount} finalists for Stage 2
      </label>
      {msg && <p className={msg.kind === "ok" ? "form-ok" : "form-error"}>{msg.text}</p>}
      <div>
        <button
          type="button"
          className="btn btn-solid btn-sm"
          onClick={save}
          disabled={busy || stage2Locked || !confirmed || selected.size !== finalistCount}
        >
          {busy ? "Saving…" : "Confirm finalists"}
        </button>
      </div>
    </div>
  );
}
