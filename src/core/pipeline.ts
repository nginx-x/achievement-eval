// core/pipeline.ts — 원자료(rows) → Dataset 조립 (parse → merge → students)
// 완전 로컬 처리이므로 이름·학번을 그대로 유지(서버 전송·저장 없음).
import type { Dataset, ItemInfoTable, Marksheet, Student, ValidationIssue } from './types';
import type { MergedRaw } from './parse/merge';
import { parseItemInfo } from './parse/parseItemInfo';
import { parseMarksheet } from './parse/parseMarksheet';
import { mergeMarksheets } from './parse/merge';

export interface MarksheetInput {
  rows: string[][];
  name?: string;
}

export interface BuildResult {
  info: ItemInfoTable;
  dataset: Dataset;
  issues: ValidationIssue[];
}

function buildStudents(merged: MergedRaw): Student[] {
  return merged.students.map((s) => ({
    id: s.studentId || `${s.classId}/${s.seat}`,
    name: s.name,
    classId: s.classId,
    seat: s.seat,
    answers: s.answers,
    total: s.total,
    scores: s.scores,
  }));
}

/** 이미 파싱된 문항정보표 + 정오표[] → 검증된 Dataset (xlsx·pdf 공용) */
export function buildDatasetFrom(info: ItemInfoTable, sheets: Marksheet[]): BuildResult {
  const merged = mergeMarksheets(sheets, info);
  const dataset: Dataset = {
    itemInfo: info.items,
    consItems: info.consItems,
    answerKey: merged.answerKey,
    points: merged.points,
    nQuestions: merged.nQuestions,
    scoreMax: merged.scoreMax,
    students: buildStudents(merged),
    classes: merged.classes,
    meta: merged.meta,
  };
  return { info, dataset, issues: merged.issues };
}

/** 문항정보표 rows + 정오표 rows[] (xlsx) → Dataset */
export function buildDataset(itemInfoRows: string[][], marksheets: MarksheetInput[]): BuildResult {
  const info = parseItemInfo(itemInfoRows);
  const sheets = marksheets.map((m) => parseMarksheet(m.rows, m.name));
  return buildDatasetFrom(info, sheets);
}
