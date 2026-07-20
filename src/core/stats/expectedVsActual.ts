// core/stats/expectedVsActual.ts — 예상난이도 ↔ 실측 정답률 정합성(§3.7)
import type { Difficulty, DiffMismatch, ExpectedVsActual, ItemInfo, ItemStat } from '../types';
import { EXPECTED_P_RANGE } from '../config';
import { kendallTauB, mean } from './util';

const RANK: Record<string, number> = { 쉬움: 1, 보통: 2, 어려움: 3 };
const CATS: Difficulty[] = ['쉬움', '보통', '어려움'];

export function computeExpectedVsActual(itemInfo: ItemInfo[], items: ItemStat[]): ExpectedVsActual {
  const pByQ = new Map(items.map((it) => [it.qno, it.p]));
  const valid = itemInfo.filter((it) => it.difficulty !== '미상' && pByQ.has(it.qno));

  const xs = valid.map((it) => RANK[it.difficulty]);
  const ys = valid.map((it) => 1 - (pByQ.get(it.qno) ?? 0)); // 실제 난이도 = 1-P
  const tauB = kendallTauB(xs, ys);

  const meanPByDifficulty = CATS.map((d) => {
    const ps = valid.filter((it) => it.difficulty === d).map((it) => pByQ.get(it.qno) ?? 0);
    return { difficulty: d, n: ps.length, meanP: ps.length ? mean(ps) : 0 };
  });

  const mismatches: DiffMismatch[] = [];
  for (const it of valid) {
    const p = pByQ.get(it.qno) ?? 0;
    const [lo, hi] = EXPECTED_P_RANGE[it.difficulty as Exclude<Difficulty, '미상'>];
    if (p < lo) mismatches.push({ qno: it.qno, expected: it.difficulty, p, reason: '예상보다 어려웠음' });
    else if (p > hi) mismatches.push({ qno: it.qno, expected: it.difficulty, p, reason: '예상보다 쉬웠음' });
  }

  return { tauB, meanPByDifficulty, mismatches };
}
