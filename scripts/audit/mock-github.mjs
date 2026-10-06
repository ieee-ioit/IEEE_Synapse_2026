// Mock GitHub API on 127.0.0.1:4010. The repo name selects the scenario (manual §3.5):
// github.com/<anyone>/<scenario>-<anything>, e.g. github.com/team101/clean-app.
import http from "node:http";

const IST = (hhmm) => new Date(`2026-10-09T${hhmm}:00+05:30`).toISOString();
const commit = (date, committerDate = date) => [{ sha: "abc", commit: { author: { date }, committer: { date: committerDate } } }];
export const hits = [];

function scenario(name) {
  return name.split("-")[0];
}

const server = http.createServer(async (req, res) => {
  const u = new URL(req.url, "http://x");
  hits.push(u.pathname);
  const m = u.pathname.match(/^\/repos\/([^/]+)\/([^/]+)\/(commits|readme|collaborators.*)$/);
  const json = (s, body, headers = {}) => {
    res.writeHead(s, { "content-type": "application/json", ...headers });
    res.end(JSON.stringify(body));
  };
  if (!m) return json(404, { message: "Not Found" });
  const [, owner, repo, what] = m;
  const sc = scenario(repo);

  if (sc === "server") {
    if (repo.includes("hang")) return; // never answers: client timeout must fire
    return json(500, { message: "boom" });
  }
  if (sc === "private") return json(404, { message: "Not Found" });
  if (sc === "ratelimited") return json(403, { message: "API rate limit exceeded" }, { "x-ratelimit-remaining": "0", "x-ratelimit-reset": String(Math.floor(Date.now() / 1000) + 600) });
  if (what === "readme") return sc === "noreadme" ? json(404, { message: "Not Found" }) : json(200, { name: "README.md" });
  if (what.startsWith("collaborators")) return sc === "noreviewer" ? json(404, {}) : json(204, {});
  // commits
  if (sc === "empty") return json(409, { message: "Git Repository is empty." });
  if (sc === "early") return json(200, commit(IST("08:10")));
  if (sc === "forged") return json(200, commit(IST("09:30"), IST("09:31"))); // old code re-dated to after 09:00 — passes (design limit)
  if (sc === "huge") {
    const page = Number(u.searchParams.get("page") || 1);
    const last = 10000;
    const link = `<http://127.0.0.1:4010/repos/${owner}/${repo}/commits?per_page=1&page=${last}>; rel="last"`;
    return json(200, commit(page === last ? IST("09:02") : IST("14:00")), { link });
  }
  return json(200, commit(IST("09:20"))); // clean / noreadme / noreviewer
});

server.listen(4010, "127.0.0.1", () => console.log("mock github on 4010"));
