// core/stats/achievement.ts — 성취수준 판정·분포
import type { AchievementLevel, AchievementSummary, AnswerCode, ClassItemRates, Cutoffs, LevelSummary, Student } from '../types';
import { LEVELS } from '../types';
import { isCorrectResponse } from '../responseCodes';
import { mean, pstdev } from './util';


export function levelOf(total: number, c: Cutoffs): AchievementLevel {
  if (total >= c.AB) return 'A';
  if (total >= c.BC) return 'B';
  if (total >= c.CD) return 'C';
  if (total >= c.DE) return 'D';
  return 'E';
}

export function levelsFor(students: Student[], c: Cutoffs): AchievementLevel[] {
  return students.map((s) => levelOf(s.total, c));
}

export function computeAchievement(students: Student[], cutoffs: Cutoffs): AchievementSummary {
  const levels = levelsFor(students, cutoffs);
  const n = students.length;
  const totals = students.map((s) => s.total);

  const distribution: LevelSummary[] = LEVELS.map((lv) => {
    const scores = students.filter((_, i) => levels[i] === lv).map((s) => s.total);
    return {
      level: lv,
      n: scores.length,
      ratio: n ? scores.length / n : 0,
      meanRaw: mean(scores),
      sdRaw: pstdev(scores),
    };
  });

  const classIds = [...new Set(students.map((s) => s.classId))].sort(
    (a, b) => Number(a) - Number(b) || a.localeCompare(b),
  );
  const byClass = classIds.map((classId) => {
    const idxs = students.map((s, i) => (s.classId === classId ? i : -1)).filter((i) => i >= 0);
    const counts = Object.fromEntries(LEVELS.map((lv) => [lv, 0])) as Record<AchievementLevel, number>;
    for (const i of idxs) counts[levels[i]]++;
    const classTotals = idxs.map((i) => students[i].total);
    return { classId, counts, n: idxs.length, mean: mean(classTotals), sd: pstdev(classTotals) };
  });

  return {
    cutoffs,
    distribution,
    overall: {
      n,
      mean: mean(totals),
      sd: pstdev(totals),
      min: n ? Math.min(...totals) : 0,
      max: n ? Math.max(...totals) : 0,
    },
    byClass,
  };
}

/** 반별 문항 정답률 (A4) */
export function computeClassItemRates(students: Student[], classes: string[], nQuestions: number, answerKey: AnswerCode[] = []): ClassItemRates[] {
  return classes.map((classId) => {
    const rows = students.filter((s) => s.classId === classId);
    const rates = Array.from({ length: nQuestions }, (_, q) =>
      rows.length ? rows.reduce((a, s) => a + (isCorrectResponse(s.answers[q], answerKey[q]) ? 1 : 0), 0) / rows.length : null,
    );
    return { classId, n: rows.length, rates };
  });
}
