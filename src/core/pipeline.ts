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
  // 불일치를 확인하고 진행할 때도 첫 정오표의 실제 문항 범위에 맞춘다.
  // 정보표의 초과 문항은 제외하고, 누락 문항은 메타정보 미상으로 남긴다.
  const itemInfo = Array.from({ length: merged.nQuestions }, (_, i) =>
    info.items.find(item => item.qno === i + 1) ?? {
      qno: i + 1, area: '미상', standard: '', difficulty: '미상' as const,
      points: merged.points[i] ?? 0, answer: null, type: '선택형' as const,
    });
  const dataset: Dataset = {
    itemInfo,
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
