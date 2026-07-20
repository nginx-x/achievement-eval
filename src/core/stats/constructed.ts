// core/stats/constructed.ts — 서답형(부분점수) 분석 (§3.0)
// NEIS 정오표에는 서답형 문항별 점수가 없고 '서답형점수' 합계만 있어,
// 이 합계를 단일 폴리토머스(부분점수) 의사문항으로 분석한다.
// 라이브 앱 '서답형 문항 분석 결과' 표(최소·최대·평균·SD·정답률·변별도·수준별 정답률) 대응.
import type { AchievementLevel, ConstructedSummary, Flag, ItemInfo, ScoreParts, Student } from '../types';
import { LEVELS } from '../types';
import { mean, pstdev, pearson } from './util';

/** 부분점수 표시용 키(정수는 정수로, 소수는 최대 1자리) */
function scoreKey(v: number): string {
  return Number.isInteger(v) ? String(v) : String(Math.round(v * 10) / 10);
}

export function computeConstructed(
  students: Student[],
  levels: AchievementLevel[],
  classes: string[],
  scoreMax: ScoreParts | null,
  consItems: ItemInfo[],
): ConstructedSummary | null {
  // 서답형 배점이 없거나 점수 컬럼이 없으면 분석 대상 아님
  if (!scoreMax || scoreMax.cons <= 0) return null;
  const withScores = students.filter((s) => s.scores != null);
  if (withScores.length < 2) return null;

  const maxPoints = scoreMax.cons;
  const cons = withScores.map((s) => s.scores!.cons);
  const totals = withScores.map((s) => s.total);
  const lvls = students.map((_, i) => levels[i]).filter((_, i) => students[i].scores != null);

  const m = mean(cons);
  const sd = pstdev(cons);
  const rate = maxPoints > 0 ? m / maxPoints : 0;

  // KICE 원본 앱과 같은 비교정 변별도: 서답형점수 ↔ 총점
  const discrimination = pearson(cons, totals);

  // 성취수준별 평균·획득률
  const byLevel = LEVELS.map((lv) => {
    const xs = cons.filter((_, i) => lvls[i] === lv);
    return {
      level: lv,
      n: xs.length,
      mean: mean(xs),
      rate: xs.length ? mean(xs) / maxPoints : null,
    };
  });

  // 반별 평균·획득률
  const byClass = classes.map((classId) => {
    const xs = withScores.filter((s) => s.classId === classId).map((s) => s.scores!.cons);
    return { classId, n: xs.length, mean: mean(xs), rate: xs.length ? mean(xs) / maxPoints : 0 };
  }).filter((c) => c.n > 0);

  // 관측 점수값(오름차순) — 부분점수 분포 축
  const values = [...new Set(cons.map((v) => Math.round(v * 10) / 10))].sort((a, b) => a - b);

  const scoreDist = values.map((v) => {
    const n = cons.filter((x) => Math.round(x * 10) / 10 === v).length;
    return { score: v, n, ratio: cons.length ? n / cons.length : 0 };
  });

  // 성취수준 × 부분점수 분포(행=수준, 값=점수별 비율)
  const distByLevel = LEVELS.map((lv) => {
    const xs = cons.filter((_, i) => lvls[i] === lv).map((v) => Math.round(v * 10) / 10);
    const dist: Record<string, number> = {};
    for (const v of values) dist[scoreKey(v)] = xs.length ? xs.filter((x) => x === v).length / xs.length : 0;
    return { level: lv, n: xs.length, dist };
  });

  // 플래그: 음의 변별도(정답 채점/문항 결함 의심), 낮은 획득률
  const flags: Flag[] = [];
  if (discrimination < 0) {
    flags.push({ level: '심각', code: 'CONS_NEG_DISC', message: `서답형 변별도 음수(${discrimination.toFixed(2)}) — 채점/문항 결함 의심` });
  }

  return {
    maxPoints,
    n: withScores.length,
    min: Math.min(...cons),
    max: Math.max(...cons),
    mean: m,
    sd,
    rate,
    discrimination,
    byLevel,
    byClass,
    scoreDist,
    distByLevel,
    items: consItems,
    flags,
  };
}
