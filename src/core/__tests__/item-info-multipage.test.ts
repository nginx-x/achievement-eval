// 3페이지 초과·40문항급 문항정보표에 대한 회귀 테스트.
// 실측 좌표(숭인 PDF)·실측 행 구조(영어 XLSX)를 그대로 본떠 43문항(선택 38+서답 5)을 합성.
import { describe, expect, it } from 'vitest';
import { parseItemInfo, parseItemInfoPdf } from '../index';
import type { PdfWord } from '../parse/pdfTypes';

// ───────── 공통 스펙 ─────────
interface Spec {
  qno: number;
  area: string;
  standards: string[]; // 복수면 다중 성취기준(연접)
  diff: '어려움' | '보통' | '쉬움';
  pts: number;
  ansStr: string; // '3 ' | '별지 참조'
}

const SHORT = '[9영03-01] 문장을 의미 단위로 끊어 읽으면서 의미를 파악할 수 있다.';
const MED = '[9영03-02] 일상생활이나 친숙한 일반적 대상이나 주제에 관한 글을 읽고 세부 정보를 파악할 수 있다.';
const LONG1 = '[9영03-09] 일상생활이나 친숙한 일반적 주제의 글을 읽고 문맥을 통해 낱말, 어구 또는 문장의 함축적 의미를 추론할 수 있다.';
const LONG2 = '[9사(일사)08-01] 경제활동에서 희소성으로 인한 합리적 선택의 필요성을 이해하고 기본적인 경제 문제 해결을 위한 방식으로서 경제체제의 특징을 분석한다.';
const EXTRA = '[9영04-05] 자신이나 주변 사람, 일상생활에 관해 짧고 간단한 글을 쓸 수 있다.';

const DIFFS: Spec['diff'][] = ['어려움', '보통', '쉬움'];
const AREAS = ['읽기', '쓰기', '말하기', '읽기, 쓰기', '국민경제와 국제 거래'];
function makeSpecs(): { sel: Spec[]; cons: Spec[] } {
  const sel: Spec[] = [];
  for (let q = 1; q <= 38; q++) {
    const multi = q === 7 || q === 26 || q === 34; // 다중 성취기준
    const ansStr = `${((q - 1) % 5) + 1} `;
    sel.push({
      qno: q,
      area: multi ? '읽기, 쓰기' : AREAS[q % 3],
      standards: multi ? [q === 7 ? SHORT : LONG1, EXTRA] : [q % 3 === 0 ? LONG2 : q % 3 === 1 ? LONG1 : MED],
      diff: DIFFS[q % 3],
      pts: (q % 3) + 2,
      ansStr,
    });
  }
  const cons: Spec[] = [1, 2, 3, 4, 5].map((q) => ({
    qno: q,
    area: '쓰기',
    standards: [q % 2 ? EXTRA : MED],
    diff: DIFFS[q % 3],
    pts: 2,
    ansStr: '별지 참조',
  }));
  return { sel, cons };
}

const norm = (s: string) => s.replace(/\s+/g, '');
const expectedAnswer = (s: Spec) => {
  const value = s.ansStr.trim();
  return /^\d+$/.test(value) ? Number(value) : null;
};

// ───────── XLSX 빌더(영어 예시 레이아웃: 0번호/1영역/2기준/3~5난이도/6배점/7정답) ─────────
function buildXlsxRows(sel: Spec[], cons: Spec[], totalPages: number): string[][] {
  const rows: string[][] = [];
  const R = (...c: string[]) => rows.push([...c, '', '', '', '', '', ''].slice(0, 14));
  R('( 영어 ) 과목');
  R('', '', '', '', '', '', '', '', '', '', '계', '부 장', '교 감', '교 장');
  R(' 문  항  정  보  표', '', '', '(과목 코드 : 10)');
  R('2026년도 1학기 기말고사', '3학년', '', '', '총 문항수 43 문항');
  R('고사일시 2026년 07월 01일 2교시', '', '공동출제자', '홍영주 (인)');
  R('총점 100.00 점', '', '선택형 88.00 점  서답형 12.00 점');
  R('선택형 문항');
  R('문항번호', '내용영역', '성취기준', '난이도', '', '', '배점', '정답');
  R('', '', '', '어려움', '보통', '쉬움', '', '');
  let page = 1;
  const footer = () => R('', '', '', '', '', `${page++} `, '/', `${totalPages} `, '', '을지중학교');
  const itemRow = (s: Spec, stdText: string, areaText: string) => {
    const d = (x: Spec['diff']) => (s.diff === x ? '○' : '');
    R(`${s.qno} `, areaText, stdText, d('어려움'), d('보통'), d('쉬움'), `${s.pts} `, s.ansStr);
  };
  sel.forEach((s, i) => {
    const full = s.standards.join('');
    if (s.qno === 18) {
      // 실측 패턴: 시작행(앞부분) → 페이지 푸터 → 연속행(뒷부분)
      const cut = Math.floor(full.length * 0.6);
      itemRow(s, full.slice(0, cut), s.area);
      footer();
      R('', '', full.slice(cut));
    } else if (s.qno === 30) {
      // 푸터 없이 바로 연속행 + 내용영역도 줄바꿈
      const cut = Math.floor(full.length * 0.5);
      itemRow(s, full.slice(0, cut), s.area.slice(0, 3));
      R('', s.area.slice(3), full.slice(cut));
    } else {
      itemRow(s, full, s.area);
    }
    if ((i + 1) % 10 === 0 && s.qno !== 18) footer();
  });
  R('서답형 문항');
  cons.forEach((s) => itemRow(s, s.standards.join(''), s.area));
  R('총합계', '13 ', '13 ', '17 ', '100.00 ', '-', '-');
  R('비율(%)', '30 ', '30 ', '40 ', '100 ', '-', '-');
  footer();
  return rows;
}

// ───────── PDF 빌더(숭인 PDF 실측 좌표) ─────────
const LH = 14.1;
const PAGE_TOP = 86, PAGE_BOTTOM = 778, P1_TOP = 248.3;
const DIFF_X = { 어려움: 428.0, 보통: 452.2, 쉬움: 476.4 } as const;
const CHW = 9.7; // 대략적 글자폭(pt)

function wrapWords(s: string, maxChars: number): string[] {
  const out: string[] = [];
  let cur = '';
  for (const tok of s.split(' ')) {
    const cand = cur ? `${cur} ${tok}` : tok;
    if (cand.length > maxChars && cur) { out.push(cur); cur = tok; } else cur = cand;
  }
  if (cur) out.push(cur);
  return out;
}
const chunk = (s: string, n: number): string[] => {
  const out: string[] = [];
  for (let i = 0; i < s.length; i += n) out.push(s.slice(i, i + n));
  return out;
};

interface PdfGen { words: PdfWord[]; page: number; y: number; splitQnos: number[] }

function pdfWord(g: PdfGen, str: string, x: number, w?: number): void {
  const width = w ?? str.length * CHW;
  g.words.push({ str, x, y: g.y, x1: x + width, y1: g.y + 10, page: g.page, });
}
function newPdfPage(g: PdfGen, totalPages: number): void {
  const yKeep = g.y;
  g.y = 794.9;
  pdfWord(g, `${g.page}`, 285.3, 5);
  pdfWord(g, '/', 305.8, 5);
  pdfWord(g, `${totalPages}`, 325.8, 5);
  pdfWord(g, '을지중학교', 502.2, 50);
  g.y = 829.0;
  pdfWord(g, '을지중학교/2026.07.06 10:22/10.13.***.190/홍영주', 411.7, 145);
  g.page += 1;
  g.y = PAGE_TOP;
  void yKeep;
}
function pdfLine(g: PdfGen, totalPages: number, emit: () => void): void {
  if (g.y > PAGE_BOTTOM) newPdfPage(g, totalPages);
  emit();
  g.y += LH;
}

function emitPdfHeader(g: PdfGen): void {
  const H = (y: number, str: string, x: number, w: number) => {
    g.y = y; pdfWord(g, str, x, w);
  };
  H(53.2, '( 영어 ) 과목', 39.9, 97);
  H(81.6, '문', 47.7, 16); H(81.6, '항', 79.6, 16); H(81.6, '정', 111.6, 16); H(81.6, '보', 143.6, 16); H(81.6, '표', 175.5, 16);
  H(117.5, '2026년도 1학기 기말고사', 84.2, 115);
  H(117.5, '3학년', 325.4, 25);
  H(117.5, '총 문항수 43 문항', 452.2, 85);
  H(163.1, '총점 100.00 점', 144.0, 69);
  H(163.1, '선택형 88.00 점', 360.6, 79);
  H(163.1, '서답형 12.00 점', 449.9, 70);
  H(183.7, '선택형 문항', 270.3, 55);
  H(203.9, '난이도', 442.1, 30);
  H(217.1, '문항번호', 44.0, 40); H(217.1, '내용영역', 113.3, 40); H(217.1, '성취기준', 277.8, 40);
  H(217.1, '배점', 495.9, 20); H(217.1, '정답', 529.0, 20);
  H(227.7, '보통', 448.1, 18); H(227.7, '쉬움', 472.3, 18);
  H(223.2, '어려', 423.9, 18); H(232.3, '움', 428.5, 9);
  g.y = P1_TOP;
}

function emitPdfRow(g: PdfGen, s: Spec, totalPages: number): void {
  // 성취기준별로 줄을 나눠 두 번째 성취기준은 '['로 새 줄 시작(다중 성취기준 실측 패턴)
  const stdLines = s.standards.flatMap((st) => wrapWords(st, 26));
  while (stdLines.length < 2) stdLines.push('');
  const areaLines = chunk(s.area, 6);
  const startPage = g.page;
  stdLines.forEach((line, li) => {
    pdfLine(g, totalPages, () => {
      if (line) pdfWord(g, line, 177.0);
      if (li === 1) {
        pdfWord(g, `${s.qno}`, s.qno >= 10 ? 59.1 : 61.6, s.qno >= 10 ? 10 : 5);
        pdfWord(g, '○', DIFF_X[s.diff], 10);
        pdfWord(g, `${s.pts}`, 503.5, 5);
        pdfWord(g, s.ansStr.trim(), 536.5, s.ansStr.trim().length * 5);
      }
      if (li >= 1 && areaLines[li - 1]) pdfWord(g, areaLines[li - 1], 96.9);
    });
  });
  if (g.page !== startPage) g.splitQnos.push(s.qno);
}

function buildPdfWords(sel: Spec[], cons: Spec[]): { words: PdfWord[]; pages: number; splitQnos: number[] } {
  const totalPages = 4;
  const g: PdfGen = { words: [], page: 1, y: 53.2, splitQnos: [] };
  emitPdfHeader(g);
  sel.forEach((s) => emitPdfRow(g, s, totalPages));
  pdfLine(g, totalPages, () => pdfWord(g, '서답형 문항', 270.3, 55));
  cons.forEach((s) => emitPdfRow(g, s, totalPages));
  pdfLine(g, totalPages, () => {
    pdfWord(g, '총합계', 44.0, 40);
    pdfWord(g, '13', 430.0, 10); pdfWord(g, '13', 454.0, 10); pdfWord(g, '17', 478.0, 10);
    pdfWord(g, '100.00', 496.0, 30); pdfWord(g, '-', 536.5, 5);
  });
  pdfLine(g, totalPages, () => {
    pdfWord(g, '비율(%)', 44.0, 40);
    pdfWord(g, '30', 430.0, 10); pdfWord(g, '30', 454.0, 10); pdfWord(g, '40', 478.0, 10);
    pdfWord(g, '100', 496.0, 15); pdfWord(g, '-', 536.5, 5);
  });
  newPdfPage(g, totalPages); // 마지막 페이지 푸터
  return { words: g.words, pages: g.page - 1, splitQnos: g.splitQnos };
}

// ───────── 검증 러너 ─────────
interface Finding { where: string; qno: number | string; what: string }

function checkItems(
  where: string,
  parsed: { qno: number; area: string; standard: string; difficulty: string; points: number; answer: number | null; type: string }[],
  specs: Spec[],
  findings: Finding[],
  opts: { exactStandard: boolean },
): void {
  for (const s of specs) {
    const it = parsed.find((x) => x.qno === s.qno);
    if (!it) { findings.push({ where, qno: s.qno, what: '문항 누락' }); continue; }
    if (it.difficulty !== s.diff) findings.push({ where, qno: s.qno, what: `난이도 ${s.diff}→${it.difficulty}` });
    if (it.points !== s.pts) findings.push({ where, qno: s.qno, what: `배점 ${s.pts}→${it.points}` });
    const expAns = s.ansStr === '별지 참조' ? null : expectedAnswer(s);
    if (it.answer !== expAns) findings.push({ where, qno: s.qno, what: `정답 ${expAns}→${it.answer} (원문 '${s.ansStr.trim()}')` });
    const full = norm(s.standards.join(''));
    if (opts.exactStandard) {
      if (norm(it.standard) !== full) findings.push({ where, qno: s.qno, what: `성취기준 불일치: '${it.standard}'` });
    } else {
      for (const st of s.standards) {
        const code = /^\[[^\]]+\]/.exec(st)![0];
        const tail = norm(st).slice(-8);
        if (!norm(it.standard).includes(norm(code))) findings.push({ where, qno: s.qno, what: `성취기준 코드 누락 ${code}` });
        else if (!norm(it.standard).includes(tail)) findings.push({ where, qno: s.qno, what: `성취기준 뒷부분 누락(…${tail})` });
      }
    }
  }
  for (const it of parsed) {
    if (!specs.some((s) => s.qno === it.qno)) findings.push({ where, qno: it.qno, what: '스펙에 없는 유령 문항' });
  }
}

describe('3페이지 초과·43문항 스트레스(합성 데이터, 실측 레이아웃 모사)', () => {
  const { sel, cons } = makeSpecs();

  it('XLSX: 43문항·5페이지 푸터·줄바꿈 연속행·다중 성취기준', () => {
    const rows = buildXlsxRows(sel, cons, 5);
    const info = parseItemInfo(rows);
    const findings: Finding[] = [];
    if (info.items.length !== 38) findings.push({ where: 'xlsx', qno: '-', what: `선택형 ${info.items.length}/38` });
    if (info.consItems.length !== 5) findings.push({ where: 'xlsx', qno: '-', what: `서답형 ${info.consItems.length}/5` });
    checkItems('xlsx선택', info.items, sel, findings, { exactStandard: true });
    checkItems('xlsx서답', info.consItems, cons, findings, { exactStandard: true });
    if (info.subject !== '영어' || info.grade !== '3학년' || info.examName !== '1학기 기말고사')
      findings.push({ where: 'xlsx', qno: '-', what: `메타: ${info.subject}/${info.grade}/${info.examName}` });
    expect(findings).toEqual([]);
  });

  it('PDF: 43문항·4페이지·페이지 걸침 행·다중 성취기준', () => {
    const { words, pages, splitQnos } = buildPdfWords(sel, cons);
    expect(pages).toBe(4);
    expect(splitQnos.length).toBeGreaterThan(0);
    const info = parseItemInfoPdf(words);
    const findings: Finding[] = [];
    if (info.items.length !== 38) findings.push({ where: 'pdf', qno: '-', what: `선택형 ${info.items.length}/38` });
    if (info.consItems.length !== 5) findings.push({ where: 'pdf', qno: '-', what: `서답형 ${info.consItems.length}/5` });
    checkItems('pdf선택', info.items, sel, findings, { exactStandard: false });
    checkItems('pdf서답', info.consItems, cons, findings, { exactStandard: false });
    if (info.subject !== '영어' || info.grade !== '3' || info.examName !== '기말고사')
      findings.push({ where: 'pdf', qno: '-', what: `메타: ${info.subject}/${info.grade}/${info.examName}` });
    expect(findings).toEqual([]);
  });

  it('PDF: 성취기준 리드가 페이지 끝, ○ 앵커가 다음 페이지 첫 줄인 극단 분할', () => {
    const g: PdfGen = { words: [], page: 1, y: 53.2, splitQnos: [] };
    emitPdfHeader(g);
    // 1번: 정상 행
    g.y = P1_TOP;
    pdfWord(g, '[9영03-01] 문장을 의미 단위로', 177.0);
    g.y += LH; pdfWord(g, '1', 61.6, 5); pdfWord(g, '읽기', 96.9); pdfWord(g, '끊어 읽으면서 의미를 파악할', 177.0);
    pdfWord(g, '○', DIFF_X.보통, 10); pdfWord(g, '3', 503.5, 5); pdfWord(g, '2', 536.5, 5);
    g.y += LH; pdfWord(g, '수 있다.', 177.0);
    // 2번: 리드가 p1 마지막 줄(771), 앵커 줄은 p2 첫 줄(86)
    g.y = 771.0; pdfWord(g, '[9영03-02] 일상생활이나 친숙한', 177.0);
    g.y = 794.9; pdfWord(g, '1', 285.3, 5); pdfWord(g, '/', 305.8, 5); pdfWord(g, '2', 325.8, 5); pdfWord(g, '을지중학교', 502.2, 50);
    g.page = 2; g.y = PAGE_TOP;
    pdfWord(g, '2', 61.6, 5); pdfWord(g, '읽기', 96.9); pdfWord(g, '일반적 대상이나 주제에 관한 글을', 177.0);
    pdfWord(g, '○', DIFF_X.어려움, 10); pdfWord(g, '4', 503.5, 5); pdfWord(g, '5', 536.5, 5);
    g.y += LH; pdfWord(g, '읽고 세부 정보를 파악할 수 있다.', 177.0);
    const info = parseItemInfoPdf(g.words);
    expect(info.items.map((x) => x.qno)).toEqual([1, 2]);
    const q2 = info.items.find((x) => x.qno === 2)!;
    expect(q2.difficulty).toBe('어려움');
    expect(q2.points).toBe(4);
    expect(q2.answer).toBe(5);
    expect(norm(q2.standard)).toContain('[9영03-02]');
    expect(norm(q2.standard)).toContain('파악할수있다');
  });

  it('PDF: 데이터 행이 y>780인 노이즈 필터 경계에서도 문항을 인식한다', () => {
    const g: PdfGen = { words: [], page: 1, y: 53.2, splitQnos: [] };
    emitPdfHeader(g);
    g.y = 768.0; pdfWord(g, '[9영03-01] 문장을 의미 단위로', 177.0);
    g.y = 782.1; // 앵커 줄이 780 초과
    pdfWord(g, '1', 61.6, 5); pdfWord(g, '읽기', 96.9); pdfWord(g, '끊어 읽으면서 의미를 파악할', 177.0);
    pdfWord(g, '○', DIFF_X.보통, 10); pdfWord(g, '3', 503.5, 5); pdfWord(g, '2', 536.5, 5);
    const info = parseItemInfoPdf(g.words);
    const q1 = info.items.find((x) => x.qno === 1) ?? info.consItems.find((x) => x.qno === 1);
    expect(q1).toBeTruthy();
  });
});
