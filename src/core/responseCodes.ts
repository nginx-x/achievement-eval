import type { AnswerCode } from './types';

/** NEIS 학생답정오표 복수답안 코드. PDF 하단 범례와 동일하다. */
export const MULTI_ANSWER_OPTIONS: Readonly<Record<string, readonly number[]>> = {
  A: [1, 2], B: [1, 3], C: [1, 4], D: [1, 5], E: [2, 3],
  F: [2, 4], G: [2, 5], H: [3, 4], I: [3, 5], J: [4, 5],
  K: [1, 2, 3], L: [1, 2, 4], M: [1, 2, 5], N: [1, 3, 4], O: [1, 3, 5],
  P: [1, 4, 5], Q: [2, 3, 4], R: [2, 3, 5], S: [2, 4, 5], T: [3, 4, 5],
  U: [1, 2, 3, 4], V: [1, 2, 3, 5], W: [1, 2, 4, 5], X: [1, 3, 4, 5],
  Y: [2, 3, 4, 5], Z: [1, 2, 3, 4, 5],
};

const CIRCLED = ['', '①', '②', '③', '④', '⑤'];

/** 정오표 정답 행의 원문을 비교 가능한 단일 코드로 정규화한다. */
export function normalizeAnswerCode(value: unknown): AnswerCode {
  const raw = String(value ?? '').trim().toUpperCase();
  if (/^[1-5]$/.test(raw)) return raw;
  if (/^[1-5]\.0+$/.test(raw)) return raw[0];
  if (/^[A-Z]$/.test(raw)) return raw;
  return null;
}

/** 학생 응답 셀 정규화: '-'는 무응답, 알파벳은 대문자로 보존한다. */
export function normalizeResponseCell(value: unknown): string {
  const raw = String(value ?? '').trim();
  if (!raw || raw === '-') return '';
  return /^[a-z]$/i.test(raw) ? raw.toUpperCase() : raw;
}

/** NEIS 구형 점 표시와 선택지 번호·복수응답 코드 표시를 함께 판정한다. */
export function isCorrectResponse(value: unknown, answerKey: AnswerCode): boolean {
  const response = normalizeResponseCell(value);
  if (response === '.') return true;
  const code = normalizeAnswerCode(response);
  return code != null && answerKey != null && code === normalizeAnswerCode(answerKey);
}

export function decodeAnswerCode(code: AnswerCode): number[] {
  if (code == null) return [];
  if (/^[1-5]$/.test(code)) return [+code];
  return [...(MULTI_ANSWER_OPTIONS[code] ?? [])];
}

export function isMultipleAnswerCode(code: AnswerCode): boolean {
  return decodeAnswerCode(code).length > 1;
}

export function formatAnswerCode(code: AnswerCode): string {
  if (code == null) return '—';
  const options = decodeAnswerCode(code);
  if (options.length === 0) return code;
  const optionText = options.map((n) => CIRCLED[n] ?? String(n)).join('+');
  return options.length > 1 ? `${optionText} (코드 ${code})` : optionText;
}

export function formatResponseCode(code: string): string {
  const normalized = normalizeAnswerCode(code);
  if (normalized == null) return code;
  const options = decodeAnswerCode(normalized);
  const optionText = options.map((n) => CIRCLED[n] ?? String(n)).join('+');
  return options.length > 1 ? `${normalized} · ${optionText}` : `${optionText} 단일`;
}
