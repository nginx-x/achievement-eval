// core/parse/parseItemInfoPdf.ts — 문항정보표 PDF 파서 (위치기반, 난이도는 ○ x-컬럼으로 판별)
import type { Difficulty, ItemInfo, ItemInfoTable, ItemType } from '../types';
import { cxw, cyw, type PdfWord } from './pdfTypes';

const isInt = (s: string) => /^\d+$/.test(s.trim());
const toNumOrNull = (s: string): number | null => {
  const n = Number.parseFloat(s.trim());
  return Number.isFinite(n) ? n : null;
};

function shouldJoinWithSpace(prev: string, next: string): boolean {
  if (!prev || !next) return false;
  const p = prev.trimEnd();
  const n = next.trimStart();
  if (!p || !n || /^[,.;:)\]}]/.test(n)) return false;
  if (/[,\]}]$/.test(p)) return true;
  if (/문제$/.test(p)) return true;
  if (/의$/.test(p) && !/^의\s/.test(n)) return true;
  if (/[을를은는와과에도만]$/.test(p) && !/^(의|고|다|며|며서|으로|로)/.test(n)) return true;
  return false;
}

function joinPdfText(words: PdfWord[]): string {
  return words.reduce((acc, w) => {
    const next = w.str.trim();
    if (!next) return acc;
    return acc + (shouldJoinWithSpace(acc, next) ? ' ' : '') + next;
  }, '').trim();
}

function isPageNoise(w: PdfWord): boolean {
  const s = w.str.trim();
  if (/총\s*합\s*계|비율/.test(s)) return true;
  if (/학교\/\d{4}\.|^\d{1,3}\.\d{1,3}\./.test(s)) return true;
  if (cyw(w) > 780 && (s === '/' || /^\d+$/.test(s) || /학교/.test(s))) return true;
  return false;
}

export function parseItemInfoPdf(words: PdfWord[]): ItemInfoTable {
  // 헤더 라벨 x로 컬럼 경계 추정(NEIS 서식 좌표 변동 대비)
  const xOf = (t: string) => {
    const a = words.filter((w) => w.str.trim() === t);
    return a.length ? cxw(a[0]) : null;
  };
  const A = xOf('내용영역') ?? 113;
  const S = xOf('성취기준') ?? 278;
  const P = xOf('배점') ?? 496;
  const AN = xOf('정답') ?? 529;
  const diffStart = P - 78; // 난이도 3열 영역 시작
  const w3 = (P - diffStart) / 3;
  const standardLeadXs = words
    .filter((w) => /^\[/.test(w.str.trim()) && cxw(w) < diffStart)
    .map((w) => w.x);
  const standardStart = standardLeadXs.length ? Math.min(...standardLeadXs) : S - 120;
  const areaStdBoundary = standardStart - 10;

  const colOf = (w: PdfWord): 'QNO' | 'AREA' | 'STD' | 'DIFF' | 'PTS' | 'ANS' => {
    const x = cxw(w);
    if (x < A - 45) return 'QNO';
    if (w.x < areaStdBoundary) return 'AREA';
    if (x < diffStart) return 'STD';
    return x < P - 8 ? 'DIFF' : x < AN - 8 ? 'PTS' : 'ANS';
  };
  const diffOf = (x: number): Difficulty =>
    x < diffStart + w3 ? '어려움' : x < diffStart + 2 * w3 ? '보통' : '쉬움';

  const gy = (w: PdfWord) => (w.page - 1) * 1000 + cyw(w);
  const standardLeads = words
    .filter((w) => /^\[/.test(w.str.trim()) && colOf(w) === 'STD')
    .sort((a, b) => gy(a) - gy(b));
  const anchors = words
    .filter((w) => w.str.trim() === '○' && colOf(w) === 'DIFF')
    .sort((a, b) => gy(a) - gy(b));
  const qints = words
    .filter((w) => colOf(w) === 'QNO' && isInt(w.str) && +w.str >= 1 && +w.str <= 999)
    .sort((a, b) => gy(a) - gy(b));

  // 서답형 섹션 경계: '서답형 문항' 라벨 이후는 다음 페이지까지 서답형으로 분류
  const consStartG = words
    .filter((w) => /서\s*답\s*형/.test(w.str) && /문\s*항/.test(w.str))
    .map(gy)
    .sort((a, b) => a - b)[0];

  const items: ItemInfo[] = [];
  const consItems: ItemInfo[] = [];
  const seen = new Set<number>();
  const seenCons = new Set<number>();
  // 각 난이도 앵커에 대응하는 문항의 첫 성취기준 위치를 먼저 확정한다.
  // 현재 문항 안의 두 번째 '[성취기준]'을 경계로 쓰면 뒤 기준이 잘리므로,
  // 문항의 끝은 '다음 앵커에 대응하는 첫 성취기준'으로만 정한다.
  const anchoredItems = anchors.map((anchor) => {
    const anchorG = gy(anchor);
    const lead = [...standardLeads].reverse().find((w) => gy(w) <= anchorG + 2);
    return { anchor, anchorG, startG: lead ? gy(lead) : anchorG - 30 };
  });

  anchoredItems.forEach(({ anchor: a, anchorG, startG }, anchorIndex) => {
    const nextStartG = anchoredItems[anchorIndex + 1]?.startG;
    const endG = nextStartG != null && nextStartG > startG ? nextStartG : anchorG + 40;
    const band = words.filter((w) => gy(w) >= startG - 1 && gy(w) < endG - 1 && !isPageNoise(w));
    const near = qints
      .filter((w) => gy(w) >= startG - 1 && gy(w) < endG - 1)
      .sort((x, y) => Math.abs(gy(x) - anchorG) - Math.abs(gy(y) - anchorG));
    if (!near.length) return;
    const qno = +near[0].str;
    // '서답형 문항' 라벨 아래 = 서답형(선택형과 번호가 겹치므로 별도 집합으로 판정)
    const isCons = consStartG != null && anchorG >= consStartG;
    const seenSet = isCons ? seenCons : seen;
    if (seenSet.has(qno)) return;
    seenSet.add(qno);
    const inCol = (c: string) => band.filter((w) => colOf(w) === c).sort((x, y) => gy(x) - gy(y) || x.x - y.x);
    const pts = inCol('PTS').map((w) => toNumOrNull(w.str)).find((n) => n != null);
    const ans = inCol('ANS').find((w) => isInt(w.str));
    const answer = isCons ? null : (ans ? +ans.str : null);
    // 실제 분석 정답은 학생답정오표에서 읽으므로, 유형은 섹션만 신뢰한다.
    const type: ItemType = isCons ? '서답형' : '선택형';
    (isCons ? consItems : items).push({
      qno,
      area: joinPdfText(inCol('AREA')),
      standard: joinPdfText(inCol('STD')),
      difficulty: diffOf(cxw(a)),
      points: pts ?? 0,
      answer,
      type,
    });
  });
  items.sort((a, b) => a.qno - b.qno);
  consItems.sort((a, b) => a.qno - b.qno);

  const text = words.map((w) => w.str).join(' ');
  return {
    subject: /\(\s*([^()]+?)\s*\)\s*과목/.exec(text)?.[1] ?? '',
    grade: /(\d+)\s*학년/.exec(text)?.[1] ?? '',
    examName: /(중간고사|기말고사)/.exec(text)?.[1] ?? '',
    totalScore: 100,
    items,
    consItems,
  };
}
