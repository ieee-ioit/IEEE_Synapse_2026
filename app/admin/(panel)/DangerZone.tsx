"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/components/api";

export default function DangerZone() {
  const router = useRouter();
  const [confirm, setConfirm] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  async function reset(scope: "scores" | "everything") {
    const what = scope === "scores" ? "all imported scores" : "every team, member, score and team login log";
    if (!window.confirm(`Permanently delete ${what}? This cannot be undone.`)) return;
    setBusy(true);
    const res = await api("/api/admin/reset", { scope, confirm, password });
    setBusy(false);
    setMsg(res.ok ? "Done." : res.error);
    if (res.ok) {
      setConfirm("");
      setPassword("");
      router.refresh();
    }
  }

  return (
    <section className="panel" style={{ borderColor: "rgba(239,68,68,0.35)" }}>
      <div className="panel-title">Danger zone — for clearing dry-run data</div>
      <div className="stack">
        <input
          className="input input--sm"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          placeholder='Type "DELETE" to enable'
          aria-label="Type DELETE to confirm"
        />
        <input
          className="input input--sm"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Your admin password"
          aria-label="Your admin password"
          autoComplete="current-password"
        />
        <p className="form-note">Only works where ALLOW_RESET=1 is set (never on the live event site).</p>
        <div className="row">
          <button type="button" className="btn btn-danger btn-sm" disabled={busy || confirm !== "DELETE" || !password} onClick={() => reset("scores")}>
            Delete all scores
          </button>
          <button type="button" className="btn btn-danger btn-sm" disabled={busy || confirm !== "DELETE" || !password} onClick={() => reset("everything")}>
            Delete all teams &amp; scores
          </button>
        </div>
        {msg && <p className="form-note">{msg}</p>}
      </div>
    </section>
  );
}
