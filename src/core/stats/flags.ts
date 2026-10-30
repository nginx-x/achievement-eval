// core/stats/flags.ts — 문항 위험 플래그(로버스트 규칙 §3.5)
import type { AchievementLevel, Difficulty, Flag, LevelRate } from '../types';
import { LEVELS } from '../types';
import { EXPECTED_P_RANGE, REVERSAL } from '../config';
import { propDiffCI } from './util';

function aggregate(rates: LevelRate[], set: AchievementLevel[]): { p: number; n: number } {
  let num = 0, n = 0;
  for (const r of rates) {
    if (set.includes(r.level) && r.p != null) { num += r.p * r.n; n += r.n; }
  }
  return { p: n ? num / n : 0, n };
}

export interface FlagInput {
  p: number;
  discrimination: number;
  difficulty: Difficulty;
  pByLevel: LevelRate[];
}

/** 심각 > 주의 > 점검 순 정렬 우선순위 */
const ORDER = { 심각: 0, 주의: 1, 점검: 2 } as const;

export function computeItemFlags(x: FlagInput): Flag[] {
  const flags: Flag[] = [];

  // 음의 상관만으로 유의성이나 문항 결함을 단정하지 않는다.
  if (x.discrimination < 0) {
    const value = Math.abs(x.discrimination) < 0.005 ? x.discrimination.toExponential(1) : x.discrimination.toFixed(2);
    flags.push({ level: '점검', code: 'NEG_DISC', message: `음의 변별도(${value}) 관찰 — 표본 크기와 응답 패턴을 함께 검토하세요` });
  }

  // 2) 성취수준 역전 (상위 A+B vs 하위 D+E): 관찰값상 역전이면 모두 표시한다.
  const upper = aggregate(x.pByLevel, ['A', 'B']);
  const lower = aggregate(x.pByLevel, ['D', 'E']);
  if (upper.n > 0 && lower.n > 0 && lower.p > upper.p) {
    const ci = propDiffCI(lower.p, lower.n, upper.p, upper.n);
    const enough = upper.n >= REVERSAL.MIN_BAND_N && lower.n >= REVERSAL.MIN_BAND_N;
    const detail = `상위 ${upper.n}명·하위 ${lower.n}명, 차이 ${(ci.diff * 100).toFixed(1)}%p`;
    if (enough && ci.diff >= REVERSAL.MARGIN && ci.lo > 0) {
      flags.push({ level: '심각', code: 'REVERSAL', message: `상위집단 정답률(${(upper.p * 100).toFixed(0)}%)이 하위집단(${(lower.p * 100).toFixed(0)}%)보다 낮음 — 역전(${detail}, 95% 신뢰구간 ${(ci.lo * 100).toFixed(1)}-${(ci.hi * 100).toFixed(1)}%p)` });
    } else {
      const reason = !enough ? `표본 부족: 각 집단 ${REVERSAL.MIN_BAND_N}명 이상 필요` : '차이 크기·신뢰구간 조건 미충족';
      flags.push({ level: '점검', code: 'REVERSAL_WEAK', message: `역전 관찰 — 역전 판정 보류(${detail}, ${reason})` });
    }
  }

  // 2b) 인접 수준 비단조(부분 역전): 집계 역전만으로는 B<C 같은 부분 역전이 묻힘.
  //     실제 인접 수준끼리 최소 인원·차이 조건을 만족할 때만 표시한다.
  const seq = LEVELS.map(level => x.pByLevel.find(r => r.level === level));
  const inv: string[] = [];
  for (let i = 0; i + 1 < seq.length; i++) {
    const hi = seq[i], lo = seq[i + 1]; // A→E 순
    if (hi && lo && hi.p != null && lo.p != null && hi.n >= REVERSAL.ADJ_MIN_N && lo.n >= REVERSAL.ADJ_MIN_N && lo.p - hi.p >= REVERSAL.ADJ_MARGIN) {
      inv.push(`${lo.level}(${(lo.p! * 100).toFixed(0)}%) > ${hi.level}(${(hi.p! * 100).toFixed(0)}%)`);
    }
  }
  if (inv.length > 0) {
    flags.push({ level: '점검', code: 'NONMONOTONE', message: `수준별 정답률 부분 역전: ${inv.join(', ')} — 하위 수준이 인접 상위 수준보다 높게 관찰됨` });
  }

  // 3) 변별도 미흡 (준거참조: 높은 P 도달 문항은 낮은 변별이 정상일 수 있어 제외)
  if (x.discrimination >= 0 && x.discrimination < 0.2 && x.p < 0.9 && !flags.some((f) => f.code === 'REVERSAL' || f.code === 'REVERSAL_WEAK')) {
    flags.push({ level: '주의', code: 'LOW_DISC', message: `변별도 ${x.discrimination.toFixed(2)} (<0.20) — 변별력 미흡` });
  }

  // 4) 예상난이도 ↔ 실측 정답률 불일치 → 점검
  if (x.difficulty !== '미상') {
    const [lo, hi] = EXPECTED_P_RANGE[x.difficulty];
    if (x.p < lo) {
      flags.push({ level: '점검', code: 'DIFF_MISMATCH', message: `'${x.difficulty}' 예상인데 정답률 ${(x.p * 100).toFixed(0)}%로 예상보다 어려웠음` });
    } else if (x.p > hi) {
      flags.push({ level: '점검', code: 'DIFF_MISMATCH', message: `'${x.difficulty}' 예상인데 정답률 ${(x.p * 100).toFixed(0)}%로 예상보다 쉬웠음` });
    }
  }

  return flags.sort((a, b) => ORDER[a.level] - ORDER[b.level]);
}
