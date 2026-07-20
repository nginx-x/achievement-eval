// core/stats/reliability.ts — Cronbach's alpha (획득배점 기준)
import type { Dataset, Reliability } from '../types';
import { CORRECT_MARK } from '../config';
import { pvariance } from './util';

const isCorrect = (cell: string) => cell.trim() === CORRECT_MARK;

/**
 * Cronbach α = k/(k-1) · (1 − Σσ²ᵢ / σ²ₜ)
 * 문항점수 = 획득배점(정답 시 배점, 오답/공백 0).
 * 서답형·기타 배점(폴리토머스)이 있으면 획득점수를 의사문항으로 포함해 총점과 정합(§3.0).
 */
export function cronbachAlpha(ds: Dataset): Reliability {
  let k = ds.nQuestions;
  const n = ds.students.length;
  if (ds.nQuestions < 2 || n < 2) return { alpha: NaN, k, nStudents: n, sem: NaN };

  let sumItemVar = 0;
  for (let i = 0; i < ds.nQuestions; i++) {
    const col = ds.students.map((s) => (isCorrect(s.answers[i] ?? '') ? ds.points[i] : 0));
    sumItemVar += pvariance(col);
  }
  // 서답형·기타 획득점수를 폴리토머스 의사문항으로 추가(배점 > 0 이고 점수 컬럼 존재 시)
  if (ds.scoreMax && ds.students.every((s) => s.scores != null)) {
    if (ds.scoreMax.cons > 0) { sumItemVar += pvariance(ds.students.map((s) => s.scores!.cons)); k++; }
    if (ds.scoreMax.etc > 0) { sumItemVar += pvariance(ds.students.map((s) => s.scores!.etc)); k++; }
  }
  const totalVar = pvariance(ds.students.map((s) => s.total));
  const alpha = totalVar === 0 ? NaN : (k / (k - 1)) * (1 - sumItemVar / totalVar);
  // 측정의 표준오차 SEM = SD·√(1−α)
  const sem = Number.isNaN(alpha) ? NaN : Math.sqrt(totalVar) * Math.sqrt(Math.max(0, 1 - alpha));
  return { alpha, k, nStudents: n, sem };
}
