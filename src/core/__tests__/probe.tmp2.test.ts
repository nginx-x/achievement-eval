// probe.tmp2.test.ts — 조사용 임시(삭제 예정): 서답형 PDF 실파싱 + 메타/꼬리행 관찰
import { describe, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { parseItemInfo, parseItemInfoPdf, sheetRows } from '../index';
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
      const yTop = vp.height - it.transform[5];
      words.push({ str: it.str, x: it.transform[4], y: yTop, x1: it.transform[4] + (it.width ?? 0), y1: yTop + (it.height ?? 10), page: p });
    }
  }
  return words;
}
const ex = (...p: string[]) => path.resolve(process.cwd(), 'example_data', ...p);

describe('probe', () => {
  it('서답형 PDF 실파싱: 마지막 선택형/서답형 문항 텍스트', async () => {
    const info = parseItemInfoPdf(await pdfWords(ex('서답형', '문항정보표.pdf')));
    console.log('sel count:', info.items.length, 'cons count:', info.consItems.length);
    for (const q of [24, 25]) console.log(`sel q${q}:`, JSON.stringify(info.items.find((x) => x.qno === q)));
    for (const c of info.consItems) console.log('cons:', JSON.stringify(c));
    console.log('meta:', info.subject, '/', info.grade, '/', info.examName);
    const xl = parseItemInfo(sheetRows(new Uint8Array(fs.readFileSync(ex('서답형', '문항정보표.xlsx')))));
    console.log('xlsx sel q25:', JSON.stringify(xl.items.find((x) => x.qno === 25)));
    console.log('xlsx meta:', xl.subject, '/', xl.grade, '/', xl.examName);
  }, 60000);

  it('영어 XLSX 메타 + 꼬리행', () => {
    const rows = sheetRows(new Uint8Array(fs.readFileSync(ex('영어', '문항정보표 데이터.xlsx'))));
    const info = parseItemInfo(rows);
    console.log('영어 meta:', JSON.stringify({ subject: info.subject, grade: info.grade, exam: info.examName, total: info.totalScore }));
    console.log('영어 last sel:', JSON.stringify(info.items[info.items.length - 1]));
    console.log('영어 rows tail:');
    for (const r of rows.slice(-6)) console.log(JSON.stringify(r));
    console.log('영어 rows head:');
    for (const r of rows.slice(0, 10)) console.log(JSON.stringify(r));
  });

  it('숭인 XLSX 꼬리행 + 메타', () => {
    const rows = sheetRows(new Uint8Array(fs.readFileSync(ex('숭인', 'download-91631650018431603.xlsx'))));
    const info = parseItemInfo(rows);
    console.log('숭인 meta:', JSON.stringify({ subject: info.subject, grade: info.grade, exam: info.examName }));
    console.log('숭인 last sel:', JSON.stringify(info.items[info.items.length - 1]));
    for (const r of rows.slice(-6)) console.log(JSON.stringify(r));
  });
});
