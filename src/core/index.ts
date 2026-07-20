// ─────────────────────────────────────────────────────────────
// core/index.ts — 공개 API 배럴. UI/io 는 이 진입점만 사용.
// (순수 로직. 브라우저·Node·CLI 어디서든 재사용 가능)
// ─────────────────────────────────────────────────────────────
export * from './types';
export * as config from './config';
export {
  MULTI_ANSWER_OPTIONS,
  normalizeAnswerCode,
  normalizeResponseCell,
  decodeAnswerCode,
  isMultipleAnswerCode,
  formatAnswerCode,
  formatResponseCode,
} from './responseCodes';

// 파싱·조립
export { sheetRows, cell, toIntOrNull, toNum } from './parse/readWorkbook';
export { parseItemInfo } from './parse/parseItemInfo';
export { parseMarksheet } from './parse/parseMarksheet';
export { parseItemInfoPdf } from './parse/parseItemInfoPdf';
export { parseMarksheetPdf } from './parse/parseMarksheetPdf';
export type { PdfWord } from './parse/pdfTypes';
export { mergeMarksheets } from './parse/merge';
export type { MergedRaw } from './parse/merge';
export { buildDataset, buildDatasetFrom } from './pipeline';
export type { MarksheetInput, BuildResult } from './pipeline';

// 분석
export { analyze } from './analyze';
export { computeAchievement, levelOf, levelsFor } from './stats/achievement';
export { computeItemStats } from './stats/itemStats';
export { cronbachAlpha } from './stats/reliability';
export { computeExpectedVsActual } from './stats/expectedVsActual';
export { computeStandards } from './stats/standards';
export { computeConstructed } from './stats/constructed';
export { computeItemFlags } from './stats/flags';
export { computeRiskSummary } from './insights/riskSummary';
export * as statsUtil from './stats/util';
