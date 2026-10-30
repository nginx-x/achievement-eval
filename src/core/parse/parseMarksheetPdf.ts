// core/parse/parseMarksheetPdf.ts — 학생답 정오표 PDF 파서 (위치기반)
// 응답 컬럼은 '번호' 행의 문항 번호 x로 동적 검출한다.
// 정답 행에 A~Z 복수답안 코드가 있어도 문항 열이 빠지지 않는다.
import type { Marksheet, RawStudent } from '../types';
import { normalizeAnswerCode, normalizeResponseCell } from '../responseCodes';
import { cxw, cyw, type PdfWord } from './pdfTypes';

const SEAT = /^\d+\s*\/\s*\d+$/;
const numRe = /^\d+(\.\d+)?$/;
const numsIn = (s: string): number[] => (s.match(/\d+(?:\.\d+)?/g) ?? []).map((n) => +n);

export function parseMarksheetPdf(words: PdfWord[], sourceName = ''): Marksheet {
  const labelRowWords = (label: string): PdfWord[] => {
    const l = words.find((w) => w.str.trim() === label);
    if (!l) return [];
    const y = cyw(l);
    return words
      .filter((w) => w.page === l.page && Math.abs(cyw(w) - y) < 4 && cxw(w) > 100 && cxw(w) < 400)
      .sort((a, b) => cxw(a) - cxw(b));
  };

  // PDF.js가 폭이 좁은 10~25번을 "10 11 ... 25" 한 토큰으로 합칠 수 있어
  // 문자열 안 숫자의 상대 위치를 토큰 폭에 투영해 각 문항 중심을 복원한다.
  const centers = labelRowWords('번호')
    .flatMap((word) => [...word.str.matchAll(/\d+/g)].map((match) => {
      const offset = (match.index ?? 0) + match[0].length / 2;
      return word.x + (offset / word.str.length) * (word.x1 - word.x);
    }));
  const N = centers.length;
  if (!N) throw new Error('정오표에서 문항 번호를 찾을 수 없습니다.');

  const closestAt = <T>(row: PdfWord[], center: number, parse: (word: PdfWord) => T | null): T | null => {
    const candidates = row
      .map((word) => ({ word, distance: Math.abs(cxw(word) - center), value: parse(word) }))
      .filter((entry) => entry.distance < 7 && entry.value != null)
      .sort((a, b) => a.distance - b.distance);
    return candidates[0]?.value ?? null;
  };

  const answerRow = labelRowWords('정답');
  const pointRow = labelRowWords('배점');
  const answerKey = centers.map((center) => closestAt(answerRow, center, (w) => normalizeAnswerCode(w.str)));
  const points = centers.map((center) => closestAt(pointRow, center, (w) => {
    const value = w.str.trim();
    return numRe.test(value) ? +value : null;
  }) ?? 0);

  const totLbls = words.filter((w) => w.str.trim() === '총점');
  const xTot = totLbls.length ? cxw(totLbls[totLbls.length - 1]) : 486;

  const rowAt = (label: PdfWord) => words.filter((w) => w.page === label.page && Math.abs(cyw(w) - cyw(label)) < 5);
  const scoreX = (label: string) => {
    const word = words.find((w) => w.str.replace(/\s/g, '').replace(/점수$/, '') === label && cxw(w) > 390);
    return word ? cxw(word) : null;
  };
  const partXs = { sel: scoreX('선택형'), cons: scoreX('서답형'), etc: scoreX('기타') };
  const scoreAt = (row: PdfWord[], x: number) => row
    .filter((w) => Math.abs(cxw(w) - x) < 14 && numRe.test(w.str.trim()))
    .sort((a, b) => Math.abs(cxw(a) - x) - Math.abs(cxw(b) - x))[0];
  const scoreParts = (row: PdfWord[]) => {
    if (partXs.sel == null || partXs.cons == null || partXs.etc == null) return null;
    const sel = scoreAt(row, partXs.sel);
    if (!sel) return null;
    return { sel: +sel.str, cons: +(scoreAt(row, partXs.cons)?.str ?? 0), etc: +(scoreAt(row, partXs.etc)?.str ?? 0) };
  };
  const pointLabel = words.find((w) => w.str.trim() === '배점');
  const scoreMax = pointLabel ? scoreParts(rowAt(pointLabel)) : null;

  const seats = words.filter((w) => SEAT.test(w.str.trim())).sort((a, b) => a.page - b.page || cyw(a) - cyw(b));
  const students: RawStudent[] = [];
  for (const st of seats) {
    const row = rowAt(st);
    const answers = Array.from({ length: N }, () => '');
    for (const t of row) {
      const x = cxw(t);
      if (x <= 100 || x >= 400 || t.str.trim() === '' || SEAT.test(t.str.trim())) continue;
      let j = 0, best = Infinity;
      for (let k = 0; k < N; k++) {
        const d = Math.abs(centers[k] - x);
        if (d < best) { best = d; j = k; }
      }
      if (best < 7) answers[j] = normalizeResponseCell(t.str);
    }
    const scoreNums = row
      .filter((w) => cxw(w) > (centers[N - 1] ?? 390) + 4)
      .sort((a, b) => cxw(a) - cxw(b))
      .flatMap((w) => numsIn(w.str));
    const totTok = scoreAt(row, xTot);
    const total = totTok ? +totTok.str : (scoreNums[scoreNums.length - 1] ?? 0);
    const [classId, seat] = st.str.trim().split('/').map((s) => s.trim());
    const name = row
      .filter((w) => /[가-힣]/.test(w.str) && cxw(w) < 105)
      .sort((a, b) => a.x - b.x)
      .map((w) => w.str)
      .join('');
    students.push({ classId, seat, studentId: '', name, answers, total, scores: scoreParts(row) });
  }

  return { meta: parseMeta(words), answerKey, points, nQuestions: N, students, scoreMax, sourceName };
}

function parseMeta(words: PdfWord[]): Marksheet['meta'] {
  const line = words.find((w) => /\d{4}학년도/.test(w.str) && /반/.test(w.str))?.str
    ?? words.map((w) => w.str).join(' ');
  return {
    schoolYear: /(\d{4})\s*학년도/.exec(line)?.[1],
    semester: /(\d)\s*학기/.exec(line)?.[1],
    grade: /(\d+)\s*학년(?!도)/.exec(line)?.[1],
    classId: /(\d+)\s*반/.exec(line)?.[1],
    examName: /(중간고사|기말고사)/.exec(line)?.[1],
    subject: /(?:중간고사|기말고사)\s+(\S+)/.exec(line)?.[1],
  };
}
