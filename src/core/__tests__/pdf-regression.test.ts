import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import {
  analyze,
  buildDatasetFrom,
  parseItemInfo,
  parseItemInfoPdf,
  parseMarksheet,
  parseMarksheetPdf,
  sheetRows,
} from '../index';
import { OTHER_RESPONSE } from '../config';
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

const exampleDir = (...parts: string[]) => path.resolve(process.cwd(), 'example_data', ...parts);
const readXlsxRows = (file: string) => sheetRows(new Uint8Array(fs.readFileSync(file)));

describe('PDF/XLSX 파서 회귀', () => {
  it('문항정보표 PDF: 한 문항의 두 성취기준을 결합하고 복수답안 표기와 무관하게 선택형을 유지한다', () => {
    const word = (str: string, x: number, y: number, width = Math.max(5, str.length * 5)): PdfWord =>
      ({ str, x, x1: x + width, y, y1: y + 8, page: 1 });
    const words: PdfWord[] = [
      word('내용영역', 93, 100, 40), word('성취기준', 258, 100, 40),
      word('배점', 486, 100, 20), word('정답', 519, 100, 20),
      word('( 영어 ) 과목', 40, 50, 90), word('3학년', 320, 60, 30), word('기말고사', 360, 60, 40),
      word('[9영03-01] 첫 번째 성취기준', 177, 250, 130),
      word('1', 60, 260), word('읽기', 100, 260, 25), word('첫 기준의 이어지는 설명', 177, 260, 110),
      word('○', 445, 260, 8), word('3', 500, 260), word('1,4', 532, 260, 15),
      word('[9영04-05] 같은 문항의 두 번째 성취기준', 177, 280, 180),
      word('[9영03-02] 다음 문항 성취기준', 177, 320, 140),
      word('2', 60, 330), word('읽기', 100, 330, 25), word('설명', 177, 330, 30),
      word('○', 470, 330, 8), word('3', 500, 330), word('2', 532, 330),
    ];

    const parsed = parseItemInfoPdf(words);
    const q1 = parsed.items.find((item) => item.qno === 1)!;
    const q2 = parsed.items.find((item) => item.qno === 2)!;

    expect(q1.standard).toContain('[9영03-01]');
    expect(q1.standard).toContain('[9영04-05]');
    expect(q1.type).toBe('선택형');
    expect(q1.answer).toBeNull(); // 분석 정답은 학생답정오표가 단일 진실원
    expect(q2.standard).toContain('[9영03-02]');
    expect(q2.answer).toBe(2);
    expect(parsed.consItems).toHaveLength(0);
  });

  it('서답형 문항정보표 XLSX: 확장 열 배치에서도 난이도·배점·정답을 읽는다', () => {
    const info = parseItemInfo(readXlsxRows(exampleDir('서답형', '문항정보표.xlsx')));

    expect(info.items).toHaveLength(25);
    expect(info.consItems).toHaveLength(3);
    expect(info.items.every((item) => item.difficulty !== '미상')).toBe(true);
    expect(info.items.map((item) => item.points).reduce((a, b) => a + b, 0)).toBe(90);
    expect(info.consItems.map((item) => item.points)).toEqual([3, 3, 4]);
    expect(info.items.every((item) => item.answer != null)).toBe(true);
  });

  it('숭인 문항정보표 PDF: XLSX와 성취기준·난이도·배점·정답이 정합된다', async () => {
    const dir = exampleDir('숭인');
    const xlsx = parseItemInfo(readXlsxRows(path.join(dir, 'download-91631650018431603.xlsx')));
    const pdf = parseItemInfoPdf(await pdfWords(path.join(dir, 'download-91631650018431603.pdf')));

    expect(pdf.items).toHaveLength(xlsx.items.length);
    for (const fromXlsx of xlsx.items) {
      const fromPdf = pdf.items.find((item) => item.qno === fromXlsx.qno);
      expect(fromPdf, `Q${fromXlsx.qno}`).toBeTruthy();
      expect(fromPdf!.standard).toBe(fromXlsx.standard);
      expect(fromPdf!.difficulty).toBe(fromXlsx.difficulty);
      expect(fromPdf!.points).toBe(fromXlsx.points);
      expect(fromPdf!.answer).toBe(fromXlsx.answer);
    }
  }, 60000);

  it('숭인 PDF 정오표: 4반 10번 김지후와 5반 10번 신서빈의 100점을 보존한다', async () => {
    const dir = exampleDir('숭인');
    const itemInfo = parseItemInfoPdf(await pdfWords(path.join(dir, 'download-91631650018431603.pdf')));
    const class4 = parseMarksheetPdf(await pdfWords(path.join(dir, '정기시험교과목별 학생답정오표(3-4).pdf')), '3-4.pdf');
    const class5 = parseMarksheetPdf(await pdfWords(path.join(dir, '정기시험교과목별 학생답정오표(3-5).pdf')), '3-5.pdf');
    const { dataset, issues } = buildDatasetFrom(itemInfo, [class4, class5]);

    expect(issues.filter((issue) => issue.severity === '차단')).toHaveLength(0);
    expect(dataset.students.find((student) => student.classId === '4' && student.seat === '10' && student.name === '김지후')?.total).toBe(100);
    expect(dataset.students.find((student) => student.classId === '5' && student.seat === '10' && student.name === '신서빈')?.total).toBe(100);
  }, 60000);

  it('숭인 혼합 입력: PDF의 비표준 응답 D를 Q1 기타 응답으로 집계한다', async () => {
    const dir = exampleDir('숭인');
    const itemInfo = parseItemInfo(readXlsxRows(path.join(dir, 'download-91631650018431603.xlsx')));
    const xlsxMarks = [
      'download-91631548285547327.xlsx',
      'download-91631559043574646.xlsx',
      'download-91631573174977428.xlsx',
    ].map((file) => parseMarksheet(readXlsxRows(path.join(dir, file)), file));
    const pdfMarks = [
      parseMarksheetPdf(await pdfWords(path.join(dir, '정기시험교과목별 학생답정오표(3-4).pdf')), '3-4.pdf'),
      parseMarksheetPdf(await pdfWords(path.join(dir, '정기시험교과목별 학생답정오표(3-5).pdf')), '3-5.pdf'),
    ];
    const { dataset, issues } = buildDatasetFrom(itemInfo, [...xlsxMarks, ...pdfMarks]);
    const result = analyze(dataset);
    const q1 = result.items.find((item) => item.qno === 1)!;
    const otherCount = Math.round((q1.distractor[OTHER_RESPONSE] ?? 0) * dataset.students.length);

    expect(issues.filter((issue) => issue.severity === '차단')).toHaveLength(0);
    expect(dataset.students).toHaveLength(129);
    expect(dataset.students.find((student) => student.name === '봉윤민')?.answers[0]).toBe('D');
    expect(otherCount).toBeGreaterThanOrEqual(1);
    expect(q1.distractorByLevel.some((row) => (row.dist[OTHER_RESPONSE] ?? 0) > 0)).toBe(true);
  }, 60000);
});
