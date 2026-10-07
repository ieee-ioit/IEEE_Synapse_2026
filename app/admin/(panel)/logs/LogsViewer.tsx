"use client";

import { useEffect, useState, useTransition } from "react";
import { formatTime } from "@/lib/format";

type AuditRow = {
  id: number;
  actor_type: string;
  actor_id: string;
  action: string;
  target_type: string;
  target_id: string;
  details: Record<string, unknown>;
  ip: string;
  user_agent: string;
  created_at: string;
};

type ErrorRow = {
  id: number;
  level: string;
  endpoint: string;
  message: string;
  stack: string;
  context: Record<string, unknown>;
  ip: string;
  user_agent: string;
  created_at: string;
};

type Stats = {
  totalAudits: number;
  totalErrors: number;
  recentErrors: number;
};

interface Props {
  initialTab?: "audit" | "error";
  initialStats: Stats;
  initialLogs: any[];
}

export default function LogsViewer({ initialTab = "audit", initialStats, initialLogs }: Props) {
  const [tab, setTab] = useState<"audit" | "error">(initialTab);
  const [stats, setStats] = useState<Stats>(initialStats);
  const [logs, setLogs] = useState<any[]>(initialLogs);
  const [query, setQuery] = useState("");
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [isPending, startTransition] = useTransition();

  const fetchLogs = (targetTab: "audit" | "error", searchQuery: string) => {
    startTransition(async () => {
      try {
        const q = encodeURIComponent(searchQuery);
        const res = await fetch(`/api/admin/logs?tab=${targetTab}&q=${q}`);
        if (!res.ok) throw new Error("Failed to load logs");
        const data = await res.json();
        setStats(data.stats);
        setLogs(data.logs);
      } catch (err) {
        console.error("Logs fetch error:", err);
      }
    });
  };

  const handleTabChange = (newTab: "audit" | "error") => {
    setTab(newTab);
    setExpandedId(null);
    fetchLogs(newTab, query);
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchLogs(tab, query);
  };

  return (
    <div>
      <div className="kpis">
        <div className="kpi">
          <div className="kpi-value mono">{stats.totalAudits}</div>
          <div className="kpi-label">Audit events tracked</div>
        </div>
        <div className="kpi">
          <div className="kpi-value mono" style={{ color: stats.totalErrors > 0 ? "var(--bad)" : "inherit" }}>
            {stats.totalErrors}
          </div>
          <div className="kpi-label">Total runtime errors</div>
        </div>
        <div className="kpi">
          <div className="kpi-value mono" style={{ color: stats.recentErrors > 0 ? "var(--bad)" : "inherit" }}>
            {stats.recentErrors}
          </div>
          <div className="kpi-label">Errors in last 24h</div>
        </div>
      </div>

      <div className="toolbar" style={{ marginTop: 24 }}>
        <div style={{ display: "flex", gap: 6 }}>
          <button
            type="button"
            className={`btn ${tab === "audit" ? "btn--primary" : "btn--secondary"}`}
            onClick={() => handleTabChange("audit")}
          >
            Audit Logs ({stats.totalAudits})
          </button>
          <button
            type="button"
            className={`btn ${tab === "error" ? "btn--primary" : "btn--secondary"}`}
            onClick={() => handleTabChange("error")}
          >
            Error Logs ({stats.totalErrors})
          </button>
        </div>

        <form onSubmit={handleSearch} style={{ display: "flex", gap: 6, flex: 1, maxWidth: 360 }}>
          <input
            type="text"
            className="input"
            style={{ width: "100%" }}
            placeholder={tab === "audit" ? "Search action, actor, target..." : "Search endpoint, message, level..."}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <button type="submit" className="btn btn--secondary" disabled={isPending}>
            Search
          </button>
        </form>

        <div className="spacer" />

        <button
          type="button"
          className="btn btn--secondary"
          onClick={() => fetchLogs(tab, query)}
          disabled={isPending}
        >
          {isPending ? "Refreshing..." : "↻ Refresh"}
        </button>
      </div>

      {tab === "audit" ? (
        <div className="table-wrap" style={{ marginTop: 12 }}>
          <table className="table">
            <thead>
              <tr>
                <th>Time</th>
                <th>Actor</th>
                <th>Action</th>
                <th>Target</th>
                <th>IP / Origin</th>
                <th>Details</th>
              </tr>
            </thead>
            <tbody>
              {(logs as AuditRow[]).map((row) => {
                const isExpanded = expandedId === row.id;
                const hasDetails = row.details && Object.keys(row.details).length > 0;
                return (
                  <tr key={row.id}>
                    <td className="mono muted" style={{ whiteSpace: "nowrap" }}>
                      {formatTime(row.created_at)}
                    </td>
                    <td>
                      <span
                        className={`pill ${
                          row.actor_type === "admin"
                            ? "pill--ok"
                            : row.actor_type === "team"
                            ? "pill--warn"
                            : ""
                        }`}
                        style={{ marginRight: 6 }}
                      >
                        {row.actor_type}
                      </span>
                      <span className="mono">{row.actor_id || "—"}</span>
                    </td>
                    <td>
                      <span className="mono" style={{ fontWeight: 600 }}>
                        {row.action}
                      </span>
                    </td>
                    <td>
                      {row.target_type ? (
                        <span>
                          <span className="muted">{row.target_type}:</span> {row.target_id || "—"}
                        </span>
                      ) : (
                        <span className="muted">—</span>
                      )}
                    </td>
                    <td className="mono muted" style={{ fontSize: 12 }}>
                      {row.ip || "—"}
                    </td>
                    <td>
                      {hasDetails ? (
                        <div>
                          <button
                            type="button"
                            className="btn btn--secondary"
                            style={{ padding: "3px 8px", fontSize: 11 }}
                            onClick={() => setExpandedId(isExpanded ? null : row.id)}
                          >
                            {isExpanded ? "Hide JSON" : "View Details"}
                          </button>
                          {isExpanded && (
                            <pre
                              style={{
                                marginTop: 6,
                                padding: 8,
                                background: "rgba(0, 0, 0, 0.4)",
                                borderRadius: 6,
                                fontSize: 11,
                                overflowX: "auto",
                                maxHeight: 180,
                              }}
                            >
                              {JSON.stringify(row.details, null, 2)}
                            </pre>
                          )}
                        </div>
                      ) : (
                        <span className="muted">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
              {!logs.length && (
                <tr>
                  <td colSpan={6} className="muted" style={{ textAlign: "center", padding: 32 }}>
                    No audit log records found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="table-wrap" style={{ marginTop: 12 }}>
          <table className="table">
            <thead>
              <tr>
                <th>Time</th>
                <th>Level</th>
                <th>Endpoint</th>
                <th>Message</th>
                <th>IP / Origin</th>
                <th>Diagnostics</th>
              </tr>
            </thead>
            <tbody>
              {(logs as ErrorRow[]).map((row) => {
                const isExpanded = expandedId === row.id;
                const hasExtra = Boolean(row.stack || (row.context && Object.keys(row.context).length > 0));
                return (
                  <tr key={row.id}>
                    <td className="mono muted" style={{ whiteSpace: "nowrap" }}>
                      {formatTime(row.created_at)}
                    </td>
                    <td>
                      <span
                        className={`pill ${
                          row.level === "fatal" || row.level === "error"
                            ? "pill--bad"
                            : "pill--warn"
                        }`}
                      >
                        {row.level}
                      </span>
                    </td>
                    <td className="mono" style={{ fontWeight: 600 }}>
                      {row.endpoint}
                    </td>
                    <td style={{ maxWidth: 360, wordBreak: "break-word" }}>
                      {row.message}
                    </td>
                    <td className="mono muted" style={{ fontSize: 12 }}>
                      {row.ip || "—"}
                    </td>
                    <td>
                      {hasExtra ? (
                        <div>
                          <button
                            type="button"
                            className="btn btn--secondary"
                            style={{ padding: "3px 8px", fontSize: 11 }}
                            onClick={() => setExpandedId(isExpanded ? null : row.id)}
                          >
                            {isExpanded ? "Hide Trace" : "View Trace"}
                          </button>
                          {isExpanded && (
                            <div
                              style={{
                                marginTop: 6,
                                padding: 8,
                                background: "rgba(0, 0, 0, 0.4)",
                                borderRadius: 6,
                                fontSize: 11,
                                overflowX: "auto",
                                maxHeight: 220,
                              }}
                            >
                              {row.context && Object.keys(row.context).length > 0 && (
                                <div style={{ marginBottom: 6 }}>
                                  <strong>Context:</strong>
                                  <pre>{JSON.stringify(row.context, null, 2)}</pre>
                                </div>
                              )}
                              {row.stack && (
                                <div>
                                  <strong>Stack Trace:</strong>
                                  <pre style={{ whiteSpace: "pre-wrap" }}>{row.stack}</pre>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      ) : (
                        <span className="muted">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
              {!logs.length && (
                <tr>
                  <td colSpan={6} className="muted" style={{ textAlign: "center", padding: 32 }}>
                    No error logs recorded. Everything running smoothly!
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
