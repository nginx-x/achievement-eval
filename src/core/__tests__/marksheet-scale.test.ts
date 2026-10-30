// 정오표 파서가 실제·확장 문항 수를 안정적으로 처리하는지 검증한다.
import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { parseMarksheet, parseMarksheetPdf } from '../index';
import type { PdfWord } from '../parse/pdfTypes';

async function pdfWords(file: string): Promise<PdfWord[]> {
  const data = new Uint8Array(fs.readFileSync(file));
  const doc = await getDocument({ data, useSystemFonts: true }).promise;
  const words: PdfWord[] = [];
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const vp = page.getViewport({ scale: 1 });
    const tc = await page.getTextContent();
    for (const it of tc.items as { str?: string; transform: number[]; width?: number; height?: number }[]) {
      if (typeof it.str !== 'string' || !it.str.trim()) continue;
      const tr = it.transform;
      const yTop = vp.height - tr[5];
      words.push({ str: it.str, x: tr[4], y: yTop, x1: tr[4] + (it.width ?? 0), y1: yTop + (it.height ?? 10), page: p });
    }
  }
  return words;
}

const PDF = path.resolve(process.cwd(), 'example_data', '숭인', '정기시험교과목별 학생답정오표(3-4).pdf');

describe('정오표 PDF 문항 수 확장', () => {
  it('baseline: 실제 25문항 PDF에서 N=25', async () => {
    const words = await pdfWords(PDF);
    const ms = parseMarksheetPdf(words, 'base');
    expect(ms.nQuestions).toBe(25);
  }, 60000);

});

describe('정오표 XLSX 문항 수 확장', () => {
  it('45문항 합성 헤더에서도 N·점수열을 올바르게 잡는다', () => {
    const qs = Array.from({ length: 45 }, (_, i) => `${i + 1} `);
    const rows: string[][] = [
      ['2026학년도   1학기   주간 3학년   1반   1학기 기말고사   영어'],
      ['반/번호', '', '번호', ...qs, '선택형점수', '서답형점수', '기타점수', '영역총점'],
      ['', '', '정답', ...qs.map(() => '3 '), '', '', '', ''],
      ['', '', '배점', ...qs.map(() => '2 '), '90.00 ', '10.00 ', '0.00 ', '100.00 '],
      ['1/1', '2024000001 ', '', ...qs.map(() => '.'), '90.00 ', '10.00 ', '0.00 ', '100.00 '],
    ];
    const ms = parseMarksheet(rows, 'syna');
    expect(ms.nQuestions).toBe(45);
    expect(ms.students[0].total).toBe(100);
    expect(ms.students[0].answers).toHaveLength(45);
  });
});
