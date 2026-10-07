import "server-only";
import { db, iso } from "./db";
import { getRanking } from "./scoring";
import { getSettings } from "./settings";

export type TeamView = {
  team: {
    id: string;
    teamNumber: number;
    name: string;
    leaderName: string;
    leaderEmail: string;
    college: string;
    repoUrl: string | null;
    demoVideoUrl: string | null;
    submittedAt: string | null;
    firstSubmittedAt: string | null;
    status: "building" | "submitted" | "disqualified";
  };
  members: { name: string; email: string }[];
  eventStart: string;
  deadline: string;
  videoUnlockAt: string;
  result: null | {
    rank: number | null;
    ranked: number;
    score?: number | null;
    criteriaScores?: { criterionId: string; name: string; weight: number; score: number }[];
  };
};

/** Everything the team dashboard shows. GitHub integrity status is admin-only (plan §9). */
export async function getTeamView(teamId: string): Promise<TeamView | null> {
  const sql = db();
  const [t] = await sql<
    {
      id: string;
      team_number: number;
      name: string;
      leader_name: string;
      leader_email: string;
      college: string;
      github_repo_url: string | null;
      demo_video_url: string | null;
      submitted_at: Date | null;
      first_submitted_at: Date | null;
      submission_status: TeamView["team"]["status"];
    }[]
  >`select id, team_number, name, leader_name, leader_email, college, github_repo_url, demo_video_url, submitted_at, first_submitted_at, submission_status
    from teams where id = ${teamId}`;
  if (!t) return null;

  const [members, settings] = await Promise.all([
    sql<{ name: string; email: string }[]>`select name, email from members where team_id = ${teamId} order by name`,
    getSettings(),
  ]);

  let result: TeamView["result"] = null;
  if (settings.leaderboardVisible && t.submission_status !== "disqualified") {
    const { teams } = await getRanking({ stage: 2 });
    // If not in stage 2 or not scored in stage 2, fall back to stage 1 ranking
    let me = teams.find((x) => x.id === teamId);
    let allRanked = teams.filter((x) => x.rank != null);
    if (!me || me.score == null) {
      const stage1 = await getRanking({ stage: 1 });
      me = stage1.teams.find((x) => x.id === teamId);
      allRanked = stage1.teams.filter((x) => x.rank != null);
    }

    result = {
      rank: me?.rank ?? null,
      ranked: allRanked.length,
      ...(settings.scoresVisible ? { score: me?.score ?? null, criteriaScores: me?.criteriaScores } : {}),
    };
  }

  return {
    team: {
      id: t.id,
      teamNumber: t.team_number,
      name: t.name,
      leaderName: t.leader_name,
      leaderEmail: t.leader_email,
      college: t.college,
      repoUrl: t.github_repo_url,
      demoVideoUrl: t.demo_video_url,
      submittedAt: iso(t.submitted_at),
      firstSubmittedAt: iso(t.first_submitted_at ?? t.submitted_at),
      status: t.submission_status,
    },
    members: [...members],
    eventStart: settings.eventStart,
    deadline: settings.submissionDeadline,
    videoUnlockAt: settings.videoUnlockAt,
    result,
  };
}
