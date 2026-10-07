"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { api } from "@/components/api";
import { toLocalInput } from "@/lib/format";
import type { Settings } from "@/lib/settings";

export default function SettingsForm({ initial }: { initial: Settings }) {
  const router = useRouter();
  // datetime-local values depend on the browser's timezone, so fill them after mount.
  const [start, setStart] = useState("");
  const [deadline, setDeadline] = useState("");
  const [videoUnlock, setVideoUnlock] = useState("");
  useEffect(() => {
    setStart(toLocalInput(initial.eventStart));
    setDeadline(toLocalInput(initial.submissionDeadline));
    setVideoUnlock(toLocalInput(initial.videoUnlockAt));
  }, [initial.eventStart, initial.submissionDeadline, initial.videoUnlockAt]);
  const [finalistCount, setFinalistCount] = useState(String(initial.finalistCount));
  const [expectedJudges, setExpectedJudges] = useState(initial.expectedJudges);
  const [themeTitle, setThemeTitle] = useState(initial.themeTitle);
  const [themeDescription, setThemeDescription] = useState(initial.themeDescription);
  const [themeRevealed, setThemeRevealed] = useState(initial.themeRevealed);
  const [msg, setMsg] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  return (
    <form
      className="stack"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setMsg(null);
        const res = await api(
          "/api/admin/settings",
          {
            eventStart: new Date(start).toISOString(),
            submissionDeadline: new Date(deadline).toISOString(),
            videoUnlockAt: videoUnlock ? new Date(videoUnlock).toISOString() : "",
            finalistCount: Number(finalistCount),
            expectedJudges,
            themeTitle,
            themeDescription,
            themeRevealed,
          },
          "PUT",
        );
        setBusy(false);
        setMsg(res.ok ? { kind: "ok", text: "Saved. Public pages update within seconds." } : { kind: "error", text: res.error });
        if (res.ok) router.refresh();
      }}
    >
      <div className="grid-2">
        <label className="field">
          <span className="label">Event start (build window opens)</span>
          <input className="input" type="datetime-local" value={start} onChange={(e) => setStart(e.target.value)} required />
        </label>
        <label className="field">
          <span className="label">Submission deadline</span>
          <input className="input" type="datetime-local" value={deadline} onChange={(e) => setDeadline(e.target.value)} required />
        </label>
      </div>
      <p className="form-note">
        Times are in your browser&rsquo;s timezone. The event start is also the GitHub first-commit baseline.
      </p>

      <div className="grid-2">
        <label className="field">
          <span className="label">Demo video links open at</span>
          <input className="input" type="datetime-local" value={videoUnlock} onChange={(e) => setVideoUnlock(e.target.value)} />
        </label>
        <label className="field">
          <span className="label">Number of Stage 2 finalists</span>
          <input className="input" type="number" min={1} max={50} value={finalistCount} onChange={(e) => setFinalistCount(e.target.value)} required />
        </label>
      </div>
      <p className="form-note">Clear the video time to use the default (event start + 4 hours).</p>
      <label className="field">
        <span className="label">Expected judges (optional, comma-separated)</span>
        <input className="input" value={expectedJudges} onChange={(e) => setExpectedJudges(e.target.value)} placeholder="e.g. Dr. Rao, Prof. Kulkarni, Ms. Iyer" />
      </label>

      <label className="field">
        <span className="label">Theme title (hidden until revealed)</span>
        <input className="input" value={themeTitle} onChange={(e) => setThemeTitle(e.target.value)} placeholder="e.g. Tech for Climate" />
      </label>
      <label className="field">
        <span className="label">Theme description</span>
        <textarea className="input" value={themeDescription} onChange={(e) => setThemeDescription(e.target.value)} />
      </label>
      <label className="switch">
        <input type="checkbox" checked={themeRevealed} onChange={(e) => setThemeRevealed(e.target.checked)} />
        <span className="switch-track" />
        Reveal theme on the About page
      </label>

      {msg && <p className={msg.kind === "ok" ? "form-ok" : "form-error"}>{msg.text}</p>}
      <div>
        <button className="btn btn-solid" disabled={busy}>
          {busy ? "Saving…" : "Save settings"}
        </button>
      </div>
    </form>
  );
}
