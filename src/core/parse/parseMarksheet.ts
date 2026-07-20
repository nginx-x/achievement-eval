// core/parse/parseMarksheet.ts — 반별 학생답 정오표(.xlsx) 파서 (§2.2)
import type { Marksheet, RawStudent, ScoreParts } from '../types';
import { cell, toIntOrNull, toNum } from './readWorkbook';
import { normalizeAnswerCode, normalizeResponseCell } from '../responseCodes';

const SEAT_RE = /^\d+\s*\/\s*\d+$/;

export function parseMarksheet(rows: string[][], sourceName = ''): Marksheet {
  // 헤더행: col2 === '번호'
  const headerIdx = rows.findIndex((r) => cell(r, 2) === '번호');
  if (headerIdx < 0) throw new Error('정오표 헤더(번호)를 찾을 수 없습니다.');
  const header = rows[headerIdx];

  // 문항 컬럼 개수 N: index3 부터 정수 헤더가 이어지는 수
  let n = 0;
  while (toIntOrNull(cell(header, 3 + n)) != null) n++;
  const Q0 = 3; // 첫 문항 컬럼

  // 점수 컬럼(선택형·서답형·기타·영역총점): 라벨로 검출, 못 찾으면 위치 기반 폴백
  const colOf = (label: string, fallback: number) => {
    const i = header.findIndex((c) => (c ?? '').toString().trim() === label);
    return i >= 0 ? i : fallback;
  };
  const selCol = colOf('선택형점수', Q0 + n);
  const consCol = colOf('서답형점수', Q0 + n + 1);
  const etcCol = colOf('기타점수', Q0 + n + 2);
  const totCol = colOf('영역총점', Q0 + n + 3);
  const hasScoreCols = header.some((c) => /선택형점수|서답형점수/.test((c ?? '').toString()));

  const findRow = (label: string) => rows.find((r) => cell(r, 2) === label);
  const answerRow = findRow('정답');
  const pointRow = findRow('배점');
  const answerKey = Array.from({ length: n }, (_, i) => (answerRow ? normalizeAnswerCode(cell(answerRow, Q0 + i)) : null));
  const points = Array.from({ length: n }, (_, i) => (pointRow ? toNum(cell(pointRow, Q0 + i)) : 0));

  // 배점행의 파트별 만점(선택형 90.00 / 서답형 10.00 / 기타 0.00)
  const scoreMax: ScoreParts | null = hasScoreCols && pointRow
    ? { sel: toNum(cell(pointRow, selCol)), cons: toNum(cell(pointRow, consCol)), etc: toNum(cell(pointRow, etcCol)) }
    : null;

  const meta = parseMeta(rows, headerIdx);

  const students: RawStudent[] = [];
  for (const r of rows) {
    const c0 = cell(r, 0);
    if (!SEAT_RE.test(c0)) continue;
    const [classId, seat] = c0.split('/').map((x) => x.trim());
    const answers = Array.from({ length: n }, (_, i) => normalizeResponseCell(cell(r, Q0 + i)));
    const total = toNum(cell(r, totCol));
    const scores: ScoreParts | null = hasScoreCols
      ? { sel: toNum(cell(r, selCol)), cons: toNum(cell(r, consCol)), etc: toNum(cell(r, etcCol)) }
      : null;
    students.push({ classId, seat, studentId: cell(r, 1), name: cell(r, 2), answers, total, scores });
  }

  return { meta, answerKey, points, nQuestions: n, students, scoreMax, sourceName };
}

function parseMeta(rows: string[][], headerIdx: number): Marksheet['meta'] {
  // 헤더 이전 행 중 '학년'과 '반'을 함께 포함하는 메타행 탐색
  for (let i = 0; i < headerIdx; i++) {
    const joined = rows[i].join(' ');
    if (/학년/.test(joined) && /반/.test(joined)) {
      return {
        schoolYear: /(\d{4})\s*학년도/.exec(joined)?.[1],
        semester: /(\d)\s*학기/.exec(joined)?.[1],
        grade: /(\d+)\s*학년(?!도)/.exec(joined)?.[1],
        classId: /(\d+)\s*반/.exec(joined)?.[1],
        examName: /(중간고사|기말고사)/.exec(joined)?.[1],
        subject: /(?:중간고사|기말고사)\s+(\S+)/.exec(joined)?.[1],
      };
    }
  }
  return {};
}
