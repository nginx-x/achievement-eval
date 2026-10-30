import { beforeAll, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { analyze, buildDatasetFrom, config, levelOf, parseMarksheetPdf } from '../index';
import type { ItemInfoTable, Marksheet } from '../types';
import type { PdfWord } from '../parse/pdfTypes';

const POINTS = [10.4, 10, 10, 10, 19.6, 40];
const TOTALS = [89.6, 79.6, 69.6, 59.6, 90, 80, 70, 60, 100, 0];
const BANDS = ['B', 'C', 'D', 'E', 'A', 'B', 'C', 'D', 'A', 'E'];
const info: ItemInfoTable = {
  subject: '합성', grade: '3', examName: '기말고사', totalScore: 100, consItems: [],
  items: POINTS.map((points, i) => ({ qno: i + 1, points, area: '합성', standard: '[합성]', difficulty: '미상', type: '선택형', answer: null })),
};

async function readPdf(encoding: string): Promise<PdfWord[]> {
  const file = fileURLToPath(new URL(`./fixtures/marksheet-decimal-${encoding}.pdf`, import.meta.url));
  const task = getDocument({ data: new Uint8Array(fs.readFileSync(file)), useSystemFonts: true });
  try {
    const doc = await task.promise;
    const words: PdfWord[] = [];
    for (let p = 1; p <= doc.numPages; p++) {
      const page = await doc.getPage(p);
      const vp = page.getViewport({ scale: 1 });
      const content = await page.getTextContent();
      for (const token of content.items) {
        if (!('str' in token) || !token.str.trim()) continue;
        const y = vp.height - token.transform[5];
        words.push({ str: token.str, x: token.transform[4], x1: token.transform[4] + token.width, y, y1: y + token.height, page: p });
      }
    }
    return words;
  } finally {
    await task.destroy();
  }
}

describe('공개 가능한 합성 PDF: 소수점·페이지 분리·두 표시 방식', () => {
  let words: PdfWord[];
  let dots: Marksheet;
  let numbers: Marksheet;
  beforeAll(async () => {
    words = await readPdf('dots');
    dots = parseMarksheetPdf(words, 'dots.pdf');
    numbers = parseMarksheetPdf(await readPdf('numbers'), 'numbers.pdf');
  });

  it('원본 PDF에 소수점 총점이 있고 응답·배점으로도 재구성된다', () => {
    const printed = words.filter(w => w.x > 472 && w.x1 < 505 && w.y > 140 && w.y < 280)
      .sort((a, b) => a.page - b.page || a.y - b.y).map(w => Number(w.str));
    expect(printed).toEqual(TOTALS);
    expect(dots.points).toEqual(POINTS);
    for (let i = 0; i < TOTALS.length; i++) {
      const student = dots.students.find(s => s.seat === String(i + 1))!;
      const reconstructed = student.answers.reduce((sum, a, q) => sum + (a === '.' ? POINTS[q] : 0), 0);
      expect(reconstructed).toBeCloseTo(TOTALS[i], 8);
    }
  });

  it.each(TOTALS.map((total, i) => ({ total, seat: String(i + 1), band: BANDS[i] })))(
    '$seat번: $total점과 성취수준 $band를 두 방식 모두 보존한다', ({ total, seat, band }) => {
      for (const sheet of [dots, numbers]) {
        const student = sheet.students.find(s => s.seat === seat)!;
        expect({ total: student.total, band: levelOf(student.total, config.DEFAULT_CUTOFFS) }).toEqual({ total, band });
      }
    });

  it('두 방식의 정답률·변별도·신뢰도·반별 집계가 동일하다', () => {
    const left = buildDatasetFrom(info, [dots]);
    const right = buildDatasetFrom(info, [numbers]);
    expect(left.issues).toEqual([]);
    expect(right.issues).toEqual([]);
    const a = analyze(left.dataset), b = analyze(right.dataset);
    expect(b).toEqual(a);
    expect(a.nStudents).toBe(10);
    expect(a.items.map(item => item.p)).toEqual([0.5, 0.3, 0.5, 0.7, 0.9, 0.8]);
    expect(a.constructed).toBeNull();
    expect(a.reliability.alpha).toBeLessThanOrEqual(1);
  });
});
