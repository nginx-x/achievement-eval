// core/parse/parseItemInfo.ts — 문항정보표(.xlsx) 파서 (2패스, 노이즈행 처리 §2.1)
import type { Difficulty, ItemInfo, ItemInfoTable, ItemType } from '../types';
import { cell, toIntOrNull, toNum } from './readWorkbook';

const SCHOOL_RE = /(중학교|고등학교|초등학교|중\s*학\s*교)/;
const isStampRow = (r: string[]) => r.some((c) => SCHOOL_RE.test(c ?? ''));
const isSubtotalRow = (r: string[]) => /총\s*합\s*계|비율/.test(cell(r, 0)) || /총\s*합\s*계|비율/.test(cell(r, 1));

interface ItemInfoLayout {
  areaCol: number;
  standardCol: number;
  difficultyCols: Record<Exclude<Difficulty, '미상'>, number>;
  pointsCol: number;
  answerCol: number;
}

function findHeaderCol(row: string[], label: string): number | null {
  const idx = row.findIndex((c) => c.replace(/\s/g, '') === label);
  return idx >= 0 ? idx : null;
}

function detectLayout(rows: string[][]): ItemInfoLayout {
  const headerIdx = rows.findIndex((r) => findHeaderCol(r, '문항번호') != null && findHeaderCol(r, '성취기준') != null);
  const header = headerIdx >= 0 ? rows[headerIdx] : [];
  const diffHeaderCol = findHeaderCol(header, '난이도') ?? 3;
  const diffLabelRow = headerIdx >= 0 ? rows.slice(headerIdx + 1, headerIdx + 4).find((r) =>
    r.some((c) => /어려움|보통|쉬움/.test(c))) : undefined;
  const diffCol = (label: Exclude<Difficulty, '미상'>, fallback: number) => {
    const idx = diffLabelRow?.findIndex((c) => c.replace(/\s/g, '') === label) ?? -1;
    return idx >= 0 ? idx : fallback;
  };

  return {
    areaCol: findHeaderCol(header, '내용영역') ?? 1,
    standardCol: findHeaderCol(header, '성취기준') ?? 2,
    difficultyCols: {
      어려움: diffCol('어려움', diffHeaderCol),
      보통: diffCol('보통', diffHeaderCol + 1),
      쉬움: diffCol('쉬움', diffHeaderCol + 2),
    },
    pointsCol: findHeaderCol(header, '배점') ?? 6,
    answerCol: findHeaderCol(header, '정답') ?? 7,
  };
}

/** 문항 시작행: col0 이 1..999 정수이고 내용영역 또는 정답이 있음 */
function itemStartQno(r: string[], layout?: ItemInfoLayout): number | null {
  const q = toIntOrNull(cell(r, 0));
  if (q == null || q < 1 || q > 999) return null;
  const areaCol = layout?.areaCol ?? 1;
  const answerCol = layout?.answerCol ?? 7;
  if (!cell(r, areaCol) && !cell(r, answerCol)) return null;
  return q;
}

function difficultyOf(r: string[], layout: ItemInfoLayout): Difficulty {
  if (cell(r, layout.difficultyCols.어려움)) return '어려움';
  if (cell(r, layout.difficultyCols.보통)) return '보통';
  if (cell(r, layout.difficultyCols.쉬움)) return '쉬움';
  return '미상';
}

/** 섹션 구분행: '서답형 문항'/'선택형 문항' 헤더 (문항 시작행·메타 배점행과 구분) */
function sectionOf(r: string[], layout?: ItemInfoLayout): '선택형' | '서답형' | null {
  if (itemStartQno(r, layout) != null) return null;
  const joined = r.join(' ');
  if (/서\s*답\s*형\s*문\s*항/.test(joined)) return '서답형';
  if (/선\s*택\s*형\s*문\s*항/.test(joined)) return '선택형';
  return null;
}

export function parseItemInfo(rows: string[][]): ItemInfoTable {
  const layout = detectLayout(rows);
  // 1패스: 문항 시작행 인덱스 + 각 행의 섹션(서답형 문항 헤더 이후 = 서답형)
  const starts: number[] = [];
  rows.forEach((r, i) => { if (itemStartQno(r, layout) != null) starts.push(i); });
  const sectionAt: ('선택형' | '서답형')[] = [];
  {
    let mode: '선택형' | '서답형' = '선택형';
    rows.forEach((r, i) => { mode = sectionOf(r, layout) ?? mode; sectionAt[i] = mode; });
  }

  const items: ItemInfo[] = [];
  const consItems: ItemInfo[] = [];
  for (let s = 0; s < starts.length; s++) {
    const i = starts[s];
    const next = s + 1 < starts.length ? starts[s + 1] : rows.length;
    const r = rows[i];
    const qno = itemStartQno(r, layout)!;

    // 2패스: 다음 시작행 전까지 줄바꿈 연속행(직인/소계 제외) 텍스트 이어붙임
    let area = cell(r, layout.areaCol);
    let standard = cell(r, layout.standardCol);
    for (let j = i + 1; j < next; j++) {
      const cont = rows[j];
      if (isStampRow(cont) || isSubtotalRow(cont)) continue;
      if (cell(cont, 0)) continue; // 다른 데이터 행 방지(안전)
      if (sectionOf(cont, layout)) break; // 섹션 경계 넘어 이어붙임 방지
      const a = cell(cont, layout.areaCol), st = cell(cont, layout.standardCol);
      if (a) area += a;
      if (st) standard += st;
    }

    const isCons = sectionAt[i] === '서답형';
    const answer = isCons ? null : toIntOrNull(cell(r, layout.answerCol)); // 서답형 정답='별지 참조' 등
    // 문항 유형은 정답 셀 형식이 아니라 문항정보표의 섹션으로 판정한다.
    // 실제 분석 정답은 학생답정오표 정답 행만 사용한다.
    const type: ItemType = isCons ? '서답형' : '선택형';
    (isCons ? consItems : items).push({
      qno,
      area: area.trim(),
      standard: standard.trim(),
      difficulty: difficultyOf(r, layout),
      points: toNum(cell(r, layout.pointsCol)),
      answer,
      type,
    });
  }
  items.sort((a, b) => a.qno - b.qno);
  consItems.sort((a, b) => a.qno - b.qno);

  return {
    subject: extractSubject(rows),
    grade: extractFirst(rows, /(\d+)\s*학년/, 0) ?? '',
    examName: extractExamName(rows),
    totalScore: extractTotalScore(rows),
    items,
    consItems,
  };
}

// ── 메타 추출(best-effort) ─────────────────────────────
function extractSubject(rows: string[][]): string {
  for (const r of rows) {
    for (const c of r) {
      const m = /\(\s*([^()]+?)\s*\)\s*과목/.exec(c ?? '');
      if (m) return m[1].trim();
    }
  }
  return '';
}
function extractFirst(rows: string[][], re: RegExp, group: number): string | null {
  for (const r of rows) for (const c of r) { const m = re.exec(c ?? ''); if (m) return group ? m[group] : m[0]; }
  return null;
}
function extractExamName(rows: string[][]): string {
  return extractFirst(rows, /(중간고사|기말고사|[0-9]학기\s*[^\s]*고사)/, 1) ?? '';
}
function extractTotalScore(rows: string[][]): number {
  const s = extractFirst(rows, /총점\s*([\d.]+)/, 1);
  return s ? toNum(s, 100) : 100;
}
