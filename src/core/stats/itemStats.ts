// core/stats/itemStats.ts — 문항별 지표(정답률·KICE 변별도·수준별·오답분포·플래그)
import type { AchievementLevel, AnswerCode, Dataset, ItemStat, LevelGap, LevelOptionDist, LevelRate } from '../types';
import { LEVELS } from '../types';
import { BOUNDARY_GAP, CORRECT_MARK, NO_RESPONSE, OTHER_RESPONSE, SHADING } from '../config';
import { decodeAnswerCode, isCorrectResponse, isMultipleAnswerCode, normalizeAnswerCode, normalizeResponseCell } from '../responseCodes';
import { pearson } from './util';
import { computeItemFlags } from './flags';

const OPTIONS = ['1', '2', '3', '4', '5'];
const DISTRACTOR_OPTIONS = [...OPTIONS, NO_RESPONSE, OTHER_RESPONSE];
const isBlank = (cell: string) => (cell ?? '').trim() === '';

/** 한 학생이 문항 i 에서 고른 보기 번호(정답이면 정답 키, 공백이면 무응답, 비표준 표기는 기타) */
function chosenOption(cell: string, answerKey: AnswerCode): string {
  if (isBlank(cell)) return NO_RESPONSE;
  if (isCorrectResponse(cell, answerKey)) return answerKey != null ? String(answerKey) : CORRECT_MARK;
  const picked = normalizeResponseCell(cell);
  if (OPTIONS.includes(picked)) return picked;
  if (isMultipleAnswerCode(answerKey) && isMultipleAnswerCode(normalizeAnswerCode(picked))) return picked;
  return OTHER_RESPONSE;
}

function optionSelection(
  cells: string[],
  indexes: number[],
  answerKey: AnswerCode,
): Record<string, number> {
  const counts: Record<string, number> = Object.fromEntries(OPTIONS.map((option) => [option, 0]));
  for (const index of indexes) {
    const cell = cells[index];
    const code = isCorrectResponse(cell, answerKey) ? answerKey : normalizeAnswerCode(cell);
    for (const option of decodeAnswerCode(code)) counts[String(option)] += 1;
  }
  for (const option of OPTIONS) counts[option] = indexes.length ? counts[option] / indexes.length : 0;
  return counts;
}

export function computeItemStats(ds: Dataset, levels: AchievementLevel[]): ItemStat[] {
  const N = ds.students.length;
  const totals = ds.students.map((s) => s.total);

  return ds.itemInfo.map((info, i) => {
    const cells = ds.students.map((s) => s.answers[i] ?? '');
    const correct01: number[] = cells.map((c) => (isCorrectResponse(c, ds.answerKey[i]) ? 1 : 0));
    const nCorrect = correct01.reduce((a, b) => a + b, 0);
    const p = N ? nCorrect / N : 0;

    // KICE 원본 앱과 같은 비교정 문항-총점 상관
    const discrimination = pearson(correct01, totals);

    // 성취수준별 정답률
    const pByLevel: LevelRate[] = LEVELS.map((lv) => {
      const idxs = levels.map((l, s) => (l === lv ? s : -1)).filter((s) => s >= 0);
      const n = idxs.length;
      const p2 = n ? idxs.reduce((a, s) => a + correct01[s], 0) / n : null;
      return { level: lv, n, p: p2 };
    });

    // 오답/보기 분포
    const distractor: Record<string, number> = {};
    for (const o of DISTRACTOR_OPTIONS) distractor[o] = 0;
    for (let s = 0; s < N; s++) {
      const opt = chosenOption(cells[s], ds.answerKey[i]);
      distractor[opt] = (distractor[opt] ?? 0) + 1;
    }
    for (const key of Object.keys(distractor)) distractor[key] = N ? distractor[key] / N : 0;
    const noResponseRate = distractor[NO_RESPONSE] ?? 0;

    // 성취수준 × 보기별 답지반응 교차표 (A2)
    const distractorByLevel: LevelOptionDist[] = LEVELS.map((lv) => {
      const idxs = levels.map((l, s) => (l === lv ? s : -1)).filter((s) => s >= 0);
      const dist: Record<string, number> = {};
      for (const o of DISTRACTOR_OPTIONS) dist[o] = 0;
      for (const s of idxs) {
        const opt = chosenOption(cells[s], ds.answerKey[i]);
        dist[opt] = (dist[opt] ?? 0) + 1;
      }
      for (const key of Object.keys(dist)) dist[key] = idxs.length ? dist[key] / idxs.length : 0;
      return { level: lv, n: idxs.length, dist };
    });

    const answerCode = ds.answerKey[i];
    const multiAnswer = isMultipleAnswerCode(answerCode)
      ? {
          answerCode: answerCode as string,
          answerOptions: decodeAnswerCode(answerCode),
          combination: distractor,
          combinationByLevel: distractorByLevel,
          optionSelection: optionSelection(cells, cells.map((_, index) => index), answerCode),
          optionSelectionByLevel: LEVELS.map((lv) => {
            const indexes = levels.map((level, index) => (level === lv ? index : -1)).filter((index) => index >= 0);
            return { level: lv, n: indexes.length, dist: optionSelection(cells, indexes, answerCode) };
          }),
        }
      : null;

    // 인접 수준 정답률 격차(경계 결정) + 대표문항(경계문항) — 강의원고 35~39p
    const pOf = (lv: AchievementLevel) => pByLevel.find((r) => r.level === lv)?.p ?? null;
    const BOUNDS: [AchievementLevel, AchievementLevel][] = [['A', 'B'], ['B', 'C'], ['C', 'D'], ['D', 'E']];
    const levelGaps: LevelGap[] = BOUNDS.map(([hi, lo]) => {
      const u = pOf(hi), l = pOf(lo);
      return { boundary: `${hi}/${lo}`, upperP: u, lowerP: l, gap: u != null && l != null ? u - l : null };
    });
    const best = levelGaps
      .filter((g) => g.gap != null && g.gap >= BOUNDARY_GAP)
      .sort((a, b) => (b.gap as number) - (a.gap as number))[0];
    const decidesBoundary = best ? { boundary: best.boundary, gap: best.gap as number } : null;
    // 대표문항: 해당 수준 ≥2/3 & 바로 아래 수준 <2/3 (E는 아래 없음)
    const M = SHADING.ITEM_P;
    const representsLevels = LEVELS.filter((lv, li) => {
      const p2 = pOf(lv);
      if (p2 == null || p2 < M) return false;
      const below = LEVELS[li + 1];
      if (!below) return true;
      const pb = pOf(below);
      return pb != null && pb < M;
    });

    const flags = computeItemFlags({ p, discrimination, difficulty: info.difficulty, pByLevel });

    return {
      qno: info.qno,
      type: info.type,
      difficulty: info.difficulty,
      points: ds.points[i],
      answer: ds.answerKey[i],
      p,
      discrimination,
      pByLevel,
      distractor,
      distractorByLevel,
      multiAnswer,
      levelGaps,
      decidesBoundary,
      representsLevels,
      noResponseRate,
      flags,
    };
  });
}
