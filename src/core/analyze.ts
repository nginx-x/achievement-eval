// ─────────────────────────────────────────────────────────────
// core/analyze.ts — 오케스트레이터: Dataset → AnalysisResult
// 순수 함수. 커트라인만 바꿔 재호출하면 전체 재계산.
// ─────────────────────────────────────────────────────────────
import type { AnalysisResult, Cutoffs, Dataset } from './types';
import { DEFAULT_CUTOFFS } from './config';
import { computeAchievement, computeClassItemRates, levelsFor } from './stats/achievement';
import { computeItemStats } from './stats/itemStats';
import { cronbachAlpha } from './stats/reliability';
import { computeExpectedVsActual } from './stats/expectedVsActual';
import { computeStandards } from './stats/standards';
import { computeConstructed } from './stats/constructed';
import { computeRiskSummary } from './insights/riskSummary';

export function analyze(ds: Dataset, cutoffs: Cutoffs = DEFAULT_CUTOFFS): AnalysisResult {
  const achievement = computeAchievement(ds.students, cutoffs);
  const levels = levelsFor(ds.students, cutoffs);
  const items = computeItemStats(ds, levels);
  const reliability = cronbachAlpha(ds);
  const expectedVsActual = computeExpectedVsActual(ds.itemInfo, items);
  const standards = computeStandards(ds.itemInfo, items);
  const classItemRates = computeClassItemRates(ds.students, ds.classes, ds.nQuestions, ds.answerKey);
  const constructed = computeConstructed(ds.students, levels, ds.classes, ds.scoreMax, ds.consItems);
  const risk = computeRiskSummary(items, achievement, reliability, expectedVsActual, constructed);

  return {
    meta: ds.meta,
    nStudents: ds.students.length,
    nQuestions: ds.nQuestions,
    classes: ds.classes,
    reliability,
    items,
    achievement,
    expectedVsActual,
    standards,
    classItemRates,
    constructed,
    risk,
  };
}
