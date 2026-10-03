import "server-only";
import { db, iso } from "./db";

export type RankedTeam = {
  id: string;
  rank: number | null; // null = not scored yet
  teamNumber: number;
  name: string;
  status: "building" | "submitted" | "disqualified";
  submittedAt: string | null;
  firstSubmittedAt: string | null;
  demoVideoUrl: string | null;
  repoUrl: string | null;
  isFinalist: boolean;
  stage2Order: number | null;
  score: number | null; // 0–10, weighted
  criteriaScored: number;
  criteriaScores?: { criterionId: string; name: string; weight: number; score: number }[];
  githubStatus: "clean" | "review" | "flagged" | null;
};

/**
 * team_score = Σ (average judge score for criterion × criterion weight %)
 * Ranks: highest score first, ties broken by earlier first_submitted_at (or submitted_at).
 * Unscored teams are listed after ranked ones with rank = null.
 */
export async function getRanking({ includeDisqualified = false, stage = 1 }: { includeDisqualified?: boolean; stage?: number } = {}): Promise<{
  teams: RankedTeam[];
  criteriaCount: number;
}> {
  const sql = db();
  const [rows, [{ n }], critList] = await Promise.all([
    sql<
      {
        id: string;
        team_number: number;
        name: string;
        submission_status: RankedTeam["status"];
        submitted_at: Date | null;
        first_submitted_at: Date | null;
        demo_video_url: string | null;
        github_repo_url: string | null;
        is_finalist: boolean;
        stage2_order: number | null;
        github_status: RankedTeam["githubStatus"];
        score: number | null;
        criteria_scored: number;
        criteria_data: { criterionId: string; avgVal: number }[] | null;
      }[]
    >`
      with per_criterion as (
        select s.team_id, s.criterion_id, avg(s.value)::float8 as v
        from scores s 
        where s.stage = ${stage}
        group by s.team_id, s.criterion_id
      ),
      per_team as (
        select pc.team_id, 
               sum(pc.v * c.weight / 100.0)::float8 as score, 
               count(*)::int as criteria_scored,
               json_agg(json_build_object('criterionId', pc.criterion_id, 'avgVal', round(pc.v::numeric, 2))) as criteria_data
        from per_criterion pc join criteria c on c.id = pc.criterion_id
        group by pc.team_id
      )
      select t.id, t.team_number, t.name, t.submission_status, t.submitted_at, t.first_submitted_at,
             t.demo_video_url, t.github_repo_url, t.is_finalist, t.stage2_order, t.github_status,
             pt.score, coalesce(pt.criteria_scored, 0) as criteria_scored, pt.criteria_data
      from teams t left join per_team pt on pt.team_id = t.id
      where ${includeDisqualified} or t.submission_status <> 'disqualified'
      order by (t.submission_status = 'disqualified'), 
               (t.is_finalist and ${stage === 2}) desc,
               pt.score desc nulls last,
               coalesce(t.first_submitted_at, t.submitted_at) asc nulls last, 
               t.team_number asc`,
    sql<{ n: number }[]>`select count(*)::int as n from criteria`,
    sql<{ id: string; name: string; weight: number }[]>`select id, name, weight::float8 as weight from criteria order by position`,
  ]);

  const critMap = new Map(critList.map((c) => [c.id, c]));

  let next = 1;
  const teams: RankedTeam[] = rows.map((r) => {
    const scoredList = (r.criteria_data || []).map((cd) => {
      const c = critMap.get(cd.criterionId);
      return {
        criterionId: cd.criterionId,
        name: c?.name ?? "Criterion",
        weight: c?.weight ?? 0,
        score: cd.avgVal,
      };
    });

    return {
      id: r.id,
      rank: r.score != null && r.submission_status !== "disqualified" ? next++ : null,
      teamNumber: r.team_number,
      name: r.name,
      status: r.submission_status,
      submittedAt: iso(r.submitted_at),
      firstSubmittedAt: iso(r.first_submitted_at ?? r.submitted_at),
      demoVideoUrl: r.demo_video_url,
      repoUrl: r.github_repo_url,
      isFinalist: Boolean(r.is_finalist),
      stage2Order: r.stage2_order,
      score: r.score == null ? null : Math.round(r.score * 100) / 100,
      criteriaScored: r.criteria_scored,
      criteriaScores: scoredList,
      githubStatus: r.github_status,
    };
  });
  return { teams, criteriaCount: n };
}

export async function getLiveVersion() {
  const [row] = await db()<{ bumped_at: Date }[]>`select bumped_at from live_signals where key = 'leaderboard'`;
  return iso(row?.bumped_at) ?? "0";
}
