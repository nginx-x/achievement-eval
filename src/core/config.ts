// ─────────────────────────────────────────────────────────────
// core/config.ts — 지표 임계·커트라인·해석밴드·시각 토큰 단일 진실원
// 정책/튜닝은 이 파일만 고치면 됨. UI/DOM 의존 0.
// ─────────────────────────────────────────────────────────────
import type { Cutoffs, Difficulty } from './types';

/** 성취수준 기본 분할점수(원점수). 사용자 수정 가능. */
export const DEFAULT_CUTOFFS: Cutoffs = { AB: 90, BC: 80, CD: 70, DE: 60 };

/** 정오표 인코딩 */
export const CORRECT_MARK = '.'; // '.' = 정답
export const NO_RESPONSE = '무응답';
export const OTHER_RESPONSE = '기타';

/** 역전/표본 관련 임계 */
export const REVERSAL = {
  MIN_BAND_N: 15, // 상위(A+B)·하위(D+E) 각각의 심각 판정 최소 인원
  MARGIN: 0.1, // 상위-하위 정답률차 유의 마진
  ADJ_MARGIN: 0.15, // 인접 수준 비단조(부분 역전) 판정 마진 — 소표본 노이즈 흡수
  ADJ_MIN_N: 5, // 비단조 비교에 포함할 수준의 최소 인원
};

/** 라이브 앱 호환 음영 임계(참고용). ITEM_P=2/3 는 '대표문항(경계문항)' 판정 기준(≈66.7%)이기도 함(강의원고 38~39p). */
export const SHADING = {
  ITEM_P: 2 / 3, // 성취수준별 정답률 2/3 미만 음영 / 대표문항 숙달 기준
  STANDARD: 0.5, // 성취기준 성취율 50% 이하 음영
};

/** 성취수준 경계를 '결정짓는' 문항: 인접 수준(A/B·B/C·C/D·D/E) 정답률 격차 임계(%p) */
export const BOUNDARY_GAP = 0.25;

// ── 해석 밴드(툴팁·게이지). 준거참조 주의 포함 ──────────────

export interface Band {
  max: number; // 이 값 미만이면 해당 라벨 (오름차순 경계)
  label: string;
  tone: 'good' | 'warn' | 'bad' | 'neutral';
}

/** 정답률 P (규준참조/변별 관점). 준거참조에선 높은 P가 결함 아님(§3.2). */
export const P_BANDS: Band[] = [
  { max: 0.2, label: '매우 어려움/점검', tone: 'bad' },
  { max: 0.3, label: '어려움', tone: 'warn' },
  { max: 0.8, label: '적정(변별 기여)', tone: 'good' },
  { max: 0.9, label: '다소 쉬움', tone: 'warn' },
  { max: Infinity, label: '변별 기여 낮음(성취 관점 정상일 수 있음)', tone: 'neutral' },
];

/** 변별도 D 공통 해석 구간(기본 표시는 KICE 방식 비교정값) */
export const DISC_BANDS: Band[] = [
  { max: 0.0, label: '음수(정답/문항 점검)', tone: 'bad' },
  { max: 0.2, label: '미흡', tone: 'bad' },
  { max: 0.3, label: '개선 여지', tone: 'warn' },
  { max: 0.4, label: '양호', tone: 'good' },
  { max: Infinity, label: '매우 양호', tone: 'good' },
];

/** 신뢰도 Cronbach α */
export const ALPHA_BANDS: Band[] = [
  { max: 0.7, label: '낮음', tone: 'bad' },
  { max: 0.8, label: '수용 가능', tone: 'warn' },
  { max: 0.9, label: '양호', tone: 'good' },
  { max: Infinity, label: '매우 높음(문항 중복 가능성 점검)', tone: 'neutral' },
];

export function bandOf(bands: Band[], value: number): Band {
  return bands.find((b) => value < b.max) ?? bands[bands.length - 1];
}

/**
 * 예상난이도가 기대하는 정답률 구간(정합성 '불일치' 판정용).
 * 범주 간 실측 P가 자연히 겹치므로, 명백히 벗어난 경우만 잡도록 관대하게(§3.7).
 * 이 구간을 벗어나면 "예상보다 쉬웠음/어려웠음" 점검 플래그.
 */
export const EXPECTED_P_RANGE: Record<Exclude<Difficulty, '미상'>, [number, number]> = {
  쉬움: [0.7, 1.0], // 쉬움 예상인데 P<0.70 → 예상보다 어려움
  보통: [0.55, 0.92],
  어려움: [0.0, 0.8], // 어려움 예상인데 P>0.80 → 예상보다 쉬움
};

// ── 시각 severity 토큰(삼중 인코딩: 색+도형+패턴+라벨) §13.5 ──

export type Severity = '심각' | '주의' | '점검' | '양호';
export interface SeverityToken {
  label: Severity;
  color: string; // ColorBrewer RdYlGn (적록색맹 검증)
  shape: string; // 도형 문자 (색 없이 구분)
  pattern: 'diagonal' | 'dots' | 'horizontal' | 'none';
  icon: string;
}
export const SEVERITY: Record<Severity, SeverityToken> = {
  심각: { label: '심각', color: '#B2182B', shape: '●', pattern: 'diagonal', icon: '🔴' },
  주의: { label: '주의', color: '#EF8A62', shape: '▲', pattern: 'dots', icon: '🟠' },
  점검: { label: '점검', color: '#FDB863', shape: '■', pattern: 'horizontal', icon: '🟡' },
  양호: { label: '양호', color: '#4D9221', shape: '—', pattern: 'none', icon: '🟢' },
};

/** 성취수준 순서형 명도 팔레트(발산형 아님) */
export const LEVEL_COLORS: Record<string, string> = {
  A: '#1a3c6e', B: '#2f6db0', C: '#5b9bd5', D: '#a9cce3', E: '#e8f0f7',
};

// ── 수치 포맷(표 정렬 일관성) ────────────────────────────────
export const FORMAT = {
  p: (v: number) => (v * 100).toFixed(1) + '%', // 정답률 2자리
  disc: (v: number) => v.toFixed(2), // 변별도 2자리
  alpha: (v: number) => v.toFixed(3), // α 3자리
  score: (v: number) => v.toFixed(1),
};
