// ui/lib/ui.ts — 표현 계층 헬퍼(필터·severity·포맷·셀 배경색). core config 를 단일원으로 참조.
import { config, type Difficulty, type Flag, type ItemStat } from '@core/index';

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

// ── 엑셀 조건부 서식식 3색 색조(red → yellow → green) ──
const EXCEL = { red: '#f8696b', yellow: '#ffeb84', green: '#63be7b' };
const hexRgb = (h: string): [number, number, number] => {
  const n = parseInt(h.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
const lerpHex = (a: string, b: string, t: number): string => {
  const A = hexRgb(a), B = hexRgb(b);
  const c = A.map((v, i) => Math.round(v + (B[i] - v) * t));
  return `rgb(${c[0]}, ${c[1]}, ${c[2]})`;
};
/** t 0..1 → red(0) · yellow(0.5) · green(1) */
export function scale3(t: number): string {
  t = clamp01(t);
  return t <= 0.5 ? lerpHex(EXCEL.red, EXCEL.yellow, t / 0.5) : lerpHex(EXCEL.yellow, EXCEL.green, (t - 0.5) / 0.5);
}

/** 예상난이도 3색: 쉬움=green · 보통=yellow · 어려움=red */
export function bgDifficulty(d: Difficulty): string {
  switch (d) {
    case '쉬움': return scale3(1);
    case '보통': return scale3(0.5);
    case '어려움': return scale3(0);
    default: return 'transparent';
  }
}

/** 정답률 3색 색조(데이터 min~max로 정규화). 낮음=red · 높음=green */
export function bgCorrectRate(p: number, min: number, max: number): string {
  const t = max > min ? (p - min) / (max - min) : 0.5;
  return scale3(t);
}

/** 변별도 배경(품질 인코딩): <0 빨강 · <0.2 호박 · 그 외 초록 그라데이션(높을수록 진함) */
export function bgDiscrimination(d: number): string {
  if (d < 0) return 'hsl(0 62% 87%)';
  if (d < 0.2) return 'hsl(30 78% 90%)';
  return `hsl(140 42% ${94 - (Math.min(d, 0.7) / 0.7) * 22}%)`; // 94%..72%
}

/** 성취수준별 셀 배경: 2/3 미만만 회색(원본 앱 방식) */
export function bgLevel(p: number | null): string {
  if (p == null) return '#f5f5f5';
  return p < config.SHADING.ITEM_P ? '#d9d9d9' : 'transparent';
}

/** 보기 선택률 셀: 정답은 초록, 오답은 빨강이며 선택률이 높을수록 진하게 표시한다. */
export function responseCellBackground(rate: number, correct: boolean): string {
  if (rate <= 0) return 'transparent';
  return correct ? `rgba(77,146,33,${0.12 + rate * 0.55})` : `rgba(200,80,80,${rate * 0.5})`;
}

/** 진단(플래그) 짧은 라벨 — 예상↔실측 병합 */
export function diagLabel(flags: Flag[]): string {
  if (!flags.length) return '';
  const f = flags[0];
  switch (f.code) {
    case 'NEG_DISC': return '정답 점검';
    case 'REVERSAL': return '역전';
    case 'REVERSAL_WEAK': return '역전';
    case 'NONMONOTONE': return '부분 역전';
    case 'LOW_DISC': return '변별 낮음';
    case 'DIFF_MISMATCH': return f.message.includes('쉬웠') ? '예상보다 쉬움' : '예상보다 어려움';
    default: return f.level;
  }
}

export const { FORMAT, SEVERITY } = config;
export type SeverityToken = (typeof config.SEVERITY)[keyof typeof config.SEVERITY];

const SEV_ORDER = ['심각', '주의', '점검'] as const;

/** 문항의 최상위 severity 토큰(플래그 없으면 양호) */
export function severityOf(flags: Flag[]): SeverityToken {
  const top = SEV_ORDER.find((lv) => flags.some((f) => f.level === lv));
  return top ? config.SEVERITY[top] : config.SEVERITY['양호'];
}

/** 문항 표 필터 정의 (§13.2) */
export interface ItemFilter {
  code: string;
  label: string;
  test: (it: ItemStat) => boolean;
}
export const ITEM_FILTERS: ItemFilter[] = [
  { code: 'flagged', label: '진단 있음', test: (it) => it.flags.length > 0 },
  { code: 'reversal', label: '역전', test: (it) => it.flags.some((f) => f.code === 'REVERSAL' || f.code === 'REVERSAL_WEAK' || f.code === 'NONMONOTONE') },
  { code: 'lowdisc', label: '변별도<0.2', test: (it) => it.discrimination < 0.2 },
  { code: 'mismatch', label: '예상 불일치', test: (it) => it.flags.some((f) => f.code === 'DIFF_MISMATCH') },
  { code: 'lowp', label: '정답률<50%', test: (it) => it.p < 0.5 },
];

export function applyFilters(items: ItemStat[], active: string[]): ItemStat[] {
  const fs = ITEM_FILTERS.filter((f) => active.includes(f.code));
  return fs.length ? items.filter((it) => fs.every((f) => f.test(it))) : items;
}

export function sortItems(items: ItemStat[], sort?: { key: string; dir: 'asc' | 'desc' }): ItemStat[] {
  if (!sort) return items;
  const val = (it: ItemStat): number => {
    switch (sort.key) {
      case 'p': return it.p;
      case 'disc': return it.discrimination;
      case 'qno': return it.qno;
      default: return it.qno;
    }
  };
  const s = [...items].sort((a, b) => val(a) - val(b));
  return sort.dir === 'desc' ? s.reverse() : s;
}
