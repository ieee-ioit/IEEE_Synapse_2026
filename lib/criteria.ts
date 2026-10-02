import "server-only";
import { db, hasDatabase } from "./db";

export type Criterion = { id: string; name: string; weight: number; position: number };

const FALLBACK: Criterion[] = [
  { id: "innovation", name: "Innovation", weight: 20, position: 1 },
  { id: "technical-implementation", name: "Technical Implementation", weight: 25, position: 2 },
  { id: "functionality", name: "Functionality", weight: 20, position: 3 },
  { id: "problem-relevance", name: "Problem Relevance", weight: 15, position: 4 },
  { id: "creativity", name: "Creativity", weight: 10, position: 5 },
  { id: "demo-explanation", name: "Demo & Explanation", weight: 5, position: 6 },
  { id: "overall-impact", name: "Overall Impact", weight: 5, position: 7 },
];

export async function getCriteria(): Promise<Criterion[]> {
  return db()<Criterion[]>`
    select id, name, weight::float8 as weight, position from criteria order by position, name`;
}

export async function getCriteriaSafe(): Promise<Criterion[]> {
  if (!hasDatabase()) return FALLBACK;
  try {
    const rows = await getCriteria();
    return rows.length ? rows : FALLBACK;
  } catch {
    return FALLBACK;
  }
}
