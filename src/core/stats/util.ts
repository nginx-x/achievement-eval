// ─────────────────────────────────────────────────────────────
// core/stats/util.ts — 순수 통계 헬퍼 (외부 의존 0)
// ─────────────────────────────────────────────────────────────

export const mean = (xs: number[]): number =>
  xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0;

export function pvariance(xs: number[]): number {
  if (xs.length === 0) return 0;
  const m = mean(xs);
  return mean(xs.map((x) => (x - m) ** 2));
}

export const pstdev = (xs: number[]): number => Math.sqrt(pvariance(xs));

/** 피어슨 상관. 분모 0이면 0 반환. */
export function pearson(xs: number[], ys: number[]): number {
  const n = Math.min(xs.length, ys.length);
  if (n === 0) return 0;
  const mx = mean(xs), my = mean(ys);
  let num = 0, dx = 0, dy = 0;
  for (let i = 0; i < n; i++) {
    const a = xs[i] - mx, b = ys[i] - my;
    num += a * b; dx += a * a; dy += b * b;
  }
  const den = Math.sqrt(dx * dy);
  return den === 0 ? 0 : num / den;
}

/** 평균순위(동점 보정) */
export function rankAverage(xs: number[]): number[] {
  const idx = xs.map((v, i) => [v, i] as [number, number]).sort((a, b) => a[0] - b[0]);
  const ranks = new Array(xs.length).fill(0);
  let i = 0;
  while (i < idx.length) {
    let j = i;
    while (j + 1 < idx.length && idx[j + 1][0] === idx[i][0]) j++;
    const avg = (i + j) / 2 + 1; // 1-based 평균순위
    for (let k = i; k <= j; k++) ranks[idx[k][1]] = avg;
    i = j + 1;
  }
  return ranks;
}

/**
 * Kendall τ-b (동점 보정). 예상난이도(3범주 다수 동점) 대비 실측에 적합.
 * τ-b = (nc - nd) / sqrt((n0 - n1)(n0 - n2))
 */
export function kendallTauB(xs: number[], ys: number[]): number | null {
  const n = Math.min(xs.length, ys.length);
  if (n < 2) return null;
  let nc = 0, nd = 0;
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const dx = Math.sign(xs[i] - xs[j]);
      const dy = Math.sign(ys[i] - ys[j]);
      const s = dx * dy;
      if (s > 0) nc++;
      else if (s < 0) nd++;
      // s === 0 : 동점 (기여 안 함)
    }
  }
  const n0 = (n * (n - 1)) / 2;
  const tieTerm = (arr: number[]) => {
    const counts = new Map<number, number>();
    for (const v of arr) counts.set(v, (counts.get(v) ?? 0) + 1);
    let t = 0;
    for (const c of counts.values()) t += (c * (c - 1)) / 2;
    return t;
  };
  const n1 = tieTerm(xs), n2 = tieTerm(ys);
  const den = Math.sqrt((n0 - n1) * (n0 - n2));
  return den === 0 ? null : (nc - nd) / den;
}

/** Wilson 구간. 0%·100%에서도 관측 비율만으로 불확실성이 0이 되지 않는다.
 * https://www.itl.nist.gov/div898/handbook/prc/section2/prc241.htm
 */
function wilsonCI(p: number, n: number): { lo: number; hi: number } {
  const z = 1.959963984540054;
  const z2 = z * z;
  const denominator = 1 + z2 / n;
  const center = (p + z2 / (2 * n)) / denominator;
  const half = z * Math.sqrt(p * (1 - p) / n + z2 / (4 * n * n)) / denominator;
  return { lo: Math.max(0, center - half), hi: Math.min(1, center + half) };
}

/** 두 비율차의 95% Newcombe 구간(Wilson 기반, 연속성 보정 없음).
 * https://www.statsmodels.org/stable/generated/statsmodels.stats.proportion.confint_proportions_2indep.html
 */
export function propDiffCI(
  p1: number, n1: number, p2: number, n2: number,
): { diff: number; lo: number; hi: number } {
  const diff = p1 - p2;
  if (n1 <= 0 || n2 <= 0) return { diff, lo: -1, hi: 1 };
  const a = wilsonCI(p1, n1), b = wilsonCI(p2, n2);
  return {
    diff,
    lo: Math.max(-1, diff - Math.hypot(p1 - a.lo, b.hi - p2)),
    hi: Math.min(1, diff + Math.hypot(a.hi - p1, p2 - b.lo)),
  };
}
