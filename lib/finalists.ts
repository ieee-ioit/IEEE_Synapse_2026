import "server-only";
import { db } from "./db";
import { getRanking } from "./scoring";
import { getSettings } from "./settings";

export type FinalistCandidate = {
  id: string;
  teamNumber: number;
  name: string;
  rank: number;
  score: number | null;
  criteriaScored: number;
  isFinalist: boolean;
};

/** Stage 1 ranking (disqualified and unscored teams excluded) plus what the selection must respect. */
export async function getFinalistCandidates() {
  const [{ teams, criteriaCount }, settings, [{ n }]] = await Promise.all([
    getRanking({ stage: 1 }),
    getSettings(),
    db()<{ n: number }[]>`select count(*)::int as n from scores where stage = 2`,
  ]);
  const ranked = teams.filter((t) => t.rank != null);
  const count = settings.finalistCount;
  const cutoff = ranked[count - 1]?.score;
  // Teams with the same Stage 1 total as the last place, when that tie crosses the cut-off.
  const tiedAtCutoff = cutoff != null && ranked[count]?.score === cutoff ? ranked.filter((t) => t.score === cutoff).map((t) => t.id) : [];
  return {
    candidates: ranked.map<FinalistCandidate>((t) => ({
      id: t.id,
      teamNumber: t.teamNumber,
      name: t.name,
      rank: t.rank!,
      score: t.score,
      criteriaScored: t.criteriaScored,
      isFinalist: t.isFinalist,
    })),
    finalistCount: count,
    criteriaCount,
    stage2Locked: n > 0,
    tiedAtCutoff,
  };
}

/** Marks exactly `finalistCount` teams as finalists, ordered by Stage 1 rank. One transaction. */
export async function setFinalists(ids: string[], opts: { confirmIncomplete?: boolean; confirmTie?: boolean }) {
  const { candidates, finalistCount, criteriaCount, stage2Locked, tiedAtCutoff } = await getFinalistCandidates();
  if (stage2Locked) return { error: "Stage 2 scores already exist, so the finalists are locked. Delete the Stage 2 scores first to change them." };
  const unique = [...new Set(ids)];
  if (unique.length !== finalistCount) return { error: `Select exactly ${finalistCount} finalists (you selected ${unique.length}).` };
  const byId = new Map(candidates.map((c) => [c.id, c]));
  const unknown = unique.filter((id) => !byId.has(id));
  if (unknown.length) return { error: "Every finalist must be a non-disqualified team with Stage 1 scores." };
  const chosen = unique.map((id) => byId.get(id)!).sort((a, b) => a.rank - b.rank);
  const incomplete = chosen.filter((c) => c.criteriaScored < criteriaCount);
  if (incomplete.length && !opts.confirmIncomplete) {
    return { error: `Team(s) ${incomplete.map((c) => c.teamNumber).join(", ")} have incomplete Stage 1 marks. Confirm to include them.` };
  }
  if (tiedAtCutoff.length && !opts.confirmTie) {
    const tied = tiedAtCutoff.map((id) => byId.get(id)!.teamNumber).join(", ");
    return { error: `Teams ${tied} are tied at the cut-off. Choose between them and confirm your choice.` };
  }

  await db().begin(async (sql) => {
    await sql`update teams set is_finalist = false, stage2_order = null where is_finalist or stage2_order is not null`;
    for (const [i, c] of chosen.entries()) await sql`update teams set is_finalist = true, stage2_order = ${i + 1} where id = ${c.id}`;
  });
  return { teamNumbers: chosen.map((c) => c.teamNumber) };
}
