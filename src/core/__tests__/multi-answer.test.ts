import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import {
  analyze,
  buildDatasetFrom,
  decodeAnswerCode,
  mergeMarksheets,
  parseItemInfo,
  parseMarksheet,
  parseMarksheetPdf,
  sheetRows,
  type Marksheet,
  type PdfWord,
} from '../index';

const dir = path.resolve(process.cwd(), 'example_data', '영어');
const rows = (file: string) => sheetRows(new Uint8Array(fs.readFileSync(path.join(dir, file))));

describe('학생답정오표 복수정답 코드', () => {
  const info = parseItemInfo(rows('문항정보표 데이터.xlsx'));
  const files = Array.from({ length: 8 }, (_, index) => `3학년 ${index + 1}반.xlsx`);
  const sheets = files.map((file) => parseMarksheet(rows(file), file));

  it('XLSX 정답 행의 A~Z 코드를 정답키로 보존한다', () => {
    const first = sheets[0];
    expect(first.answerKey[15]).toBe('C');
    expect(first.answerKey[21]).toBe('I');
    expect(first.answerKey[26]).toBe('F');
    expect(first.answerKey[31]).toBe('D');
    expect(decodeAnswerCode(first.answerKey[15])).toEqual([1, 4]);
  });

  it('8개 반의 학생답정오표 정답이 같고 문항정보표 정답은 판정에 관여하지 않는다', () => {
    const alteredInfo = {
      ...info,
      items: info.items.map((item) => ({ ...item, answer: item.qno === 16 ? 2 : item.answer })),
    };
    const { dataset, issues } = buildDatasetFrom(alteredInfo, sheets);

    expect(dataset.students).toHaveLength(228);
    expect(dataset.answerKey[15]).toBe('C');
    expect(issues.filter((issue) => issue.code === 'KEY_MISMATCH')).toHaveLength(0);
    expect(issues.some((issue) => /문항정보표.*정답|정답.*문항정보표/.test(issue.message))).toBe(false);
  });

  it('Q16은 조합별 분포와 선택지별 포함률을 함께 계산한다', () => {
    const { dataset } = buildDatasetFrom(info, [sheets[0]]);
    const q16 = analyze(dataset).items.find((item) => item.qno === 16)!;

    expect(q16.answer).toBe('C');
    expect(q16.multiAnswer?.answerOptions).toEqual([1, 4]);
    expect(q16.p).toBeCloseTo(11 / 29, 8);
    expect(q16.discrimination).toBeCloseTo(0.644809, 5);
    expect(q16.multiAnswer?.combination.C).toBeCloseTo(11 / 29, 8);
    expect(q16.multiAnswer?.combination.F).toBeCloseTo(5 / 29, 8);
    expect(q16.multiAnswer?.combination.J).toBeCloseTo(5 / 29, 8);
    expect(q16.multiAnswer?.optionSelection).toMatchObject({
      '1': 13 / 29,
      '2': 8 / 29,
      '3': 3 / 29,
      '4': 26 / 29,
      '5': 5 / 29,
    });
  });

  it('정답 충돌은 학생답정오표끼리 다를 때만 차단한다', () => {
    const changed: Marksheet = { ...sheets[1], answerKey: [...sheets[1].answerKey] };
    changed.answerKey[15] = 'F';
    const merged = mergeMarksheets([sheets[0], changed], info);

    expect(merged.issues.filter((issue) => issue.code === 'KEY_MISMATCH')).toEqual([
      expect.objectContaining({ severity: '차단', file: files[1] }),
    ]);
  });

  it('PDF는 번호 행으로 열을 고정해 알파벳 정답 뒤 문항도 보존한다', () => {
    const word = (str: string, centerX: number, y: number): PdfWord => ({
      str, x: centerX - 2, x1: centerX + 2, y, y1: y + 8, page: 1,
    });
    const words: PdfWord[] = [
      word('번호', 60, 10), { str: '1 2 3', x: 118, x1: 146, y: 10, y1: 18, page: 1 },
      word('정답', 60, 20), word('2', 120, 20), word('C', 132, 20), word('5', 144, 20),
      word('배점', 60, 30), word('3', 120, 30), word('4', 132, 30), word('3', 144, 30),
    ];

    const parsed = parseMarksheetPdf(words, 'synthetic.pdf');
    expect(parsed.nQuestions).toBe(3);
    expect(parsed.answerKey).toEqual(['2', 'C', '5']);
    expect(parsed.points).toEqual([3, 4, 3]);
  });
});
