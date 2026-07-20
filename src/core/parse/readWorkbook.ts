// core/parse/readWorkbook.ts — SheetJS 얇은 래퍼(브라우저·Node 공용, UI 의존 0)
// NEIS xlsx 는 병합셀이 없고(위장 병합) 노이즈행이 섞임 → 그리드로 읽어 파서가 처리.
import * as XLSX from 'xlsx';

/** 첫 시트를 문자열 2차원 배열로. raw:false 로 표시값 문자열 취득('.'=정답 보존). */
export function sheetRows(data: ArrayBuffer | Uint8Array): string[][] {
  const wb = XLSX.read(data, { type: 'array' });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<string[]>(ws, { header: 1, raw: false, defval: '' });
  return rows.map((r) => (Array.isArray(r) ? r.map((c) => (c == null ? '' : String(c))) : []));
}

/** 안전 셀 접근(범위 밖/undefined → '') */
export const cell = (r: string[], i: number): string => (r?.[i] ?? '').toString().trim();

export function toIntOrNull(v: string): number | null {
  const n = parseFloat(String(v).trim());
  return Number.isFinite(n) ? Math.round(n) : null;
}
export function toNum(v: string, fallback = 0): number {
  const n = parseFloat(String(v).trim());
  return Number.isFinite(n) ? n : fallback;
}
