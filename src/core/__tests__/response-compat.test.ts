import { describe, expect, it } from 'vitest';
import * as XLSX from 'xlsx';
import { analyze, buildDatasetFrom, isCorrectResponse, parseMarksheet, sheetRows, type ItemInfoTable } from '../index';

const info: ItemInfoTable = {
  subject: '합성', grade: '3', examName: '기말고사', totalScore: 100, consItems: [],
  items: [1, 2].map(qno => ({ qno, area: '', standard: '', difficulty: '미상', points: 50, answer: null, type: '선택형' })),
};
function rows(numbered: boolean): string[][] {
  return [
    ['2026학년도 2학기 3학년 1반 기말고사 합성'],
    ['반/번호', '', '번호', '1', '2', '선택형점수', '서답형점수', '기타점수', '영역총점'],
    ['', '', '정답', 'C', '2'],
    ['', '', '배점', '50', '50', '100', '0', '0', '100'],
    ['1/1', '', '', numbered ? 'C' : '.', numbered ? '2' : '.', '100', '0', '0', '100'],
    ['1/2', '', '', 'F', numbered ? '2' : '.', '50', '0', '0', '50'],
    ['1/3', '', '', numbered ? 'C' : '.', '-', '50', '0', '0', '50'],
  ];
}

describe('정답 표시 방식과 엑셀 형식 호환', () => {
  it('복수응답은 정확한 코드가 일치할 때 정답이며 빈칸은 정답이 아니다', () => {
    expect(isCorrectResponse(' c ', 'C')).toBe(true);
    expect(isCorrectResponse('F', 'C')).toBe(false);
    expect(isCorrectResponse('1', 'C')).toBe(false);
    expect(isCorrectResponse('', null)).toBe(false);
    expect(isCorrectResponse('-', null)).toBe(false);
    expect(isCorrectResponse('C', null)).toBe(false);
  });

  it('구형·번호 표시·혼합 입력의 복수응답 분포와 모든 지표가 같다', () => {
    const legacy = buildDatasetFrom(info, [parseMarksheet(rows(false))]);
    const modern = buildDatasetFrom(info, [parseMarksheet(rows(true))]);
    const mixedRows = rows(false); mixedRows[5][4] = '2';
    const mixed = buildDatasetFrom(info, [parseMarksheet(mixedRows)]);
    expect(legacy.issues).toEqual([]);
    expect(modern.issues).toEqual([]);
    expect(mixed.issues).toEqual([]);
    const expected = analyze(legacy.dataset);
    expect(analyze(modern.dataset)).toEqual(expected);
    expect(analyze(mixed.dataset)).toEqual(expected);
    expect(expected.items[0].multiAnswer?.combination.C).toBeCloseTo(2 / 3);
    expect(expected.items[0].multiAnswer?.combination.F).toBeCloseTo(1 / 3);
    expect(expected.items[0].multiAnswer?.optionSelection).toMatchObject({ '1': 2 / 3, '2': 1 / 3, '4': 1 });
    expect(expected.items[1].noResponseRate).toBeCloseTo(1 / 3);
  });

  it.each(['biff8', 'xlsx'] as const)('%s 엑셀의 번호 표시·소수점을 직접 읽는다', bookType => {
    const input = rows(true); input[4][5] = '89.60'; input[4][8] = '89.60';
    const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(input), '합성');
    const data = XLSX.write(wb, { bookType, type: 'array' });
    const parsed = parseMarksheet(sheetRows(new Uint8Array(data)));
    expect(parsed.answerKey).toEqual(['C', '2']);
    expect(parsed.students[0].total).toBe(89.6);
  });
});
