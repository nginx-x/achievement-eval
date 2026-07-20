// 임시 검증(삭제 예정): 정오표 파서의 문항 수 확장 가정 점검
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

describe('정오표 PDF 스케일 가정 (임시)', () => {
  it('baseline: 실제 25문항 PDF에서 N=25', async () => {
    const words = await pdfWords(PDF);
    const ms = parseMarksheetPdf(words, 'base');
    console.log('BASE nQuestions=', ms.nQuestions, 'students=', ms.students.length, 'answers[0].len=', ms.students[0]?.answers.length);
    expect(ms.nQuestions).toBe(25);
  }, 60000);

  it('case A: 정답행에 복수답안코드(알파벳)가 있으면 해당 열이 통째로 사라진다', async () => {
    const words = await pdfWords(PDF);
    // 정답행(y≈104.1)의 13번째 문항 정답 토큰(x≈247.4)을 'C'로 치환
    const ansY = words.find((w) => w.str.trim() === '정답')!.y;
    const t = words.find((w) => Math.abs(w.y - ansY) < 1 && Math.abs(w.x - 247.4) < 1)!;
    const mutated = words.map((w) => (w === t ? { ...w, str: 'C' } : w));
    const ms = parseMarksheetPdf(mutated, 'letter');
    console.log('LETTER nQuestions=', ms.nQuestions, 'answerKey=', JSON.stringify(ms.answerKey));
    // 학생의 13번 문항 응답이 어디로 갔는지 확인: 김지윤(4/9)은 원래 13번 응답 '.'(정답) → x≈249.4 응답 토큰
    const st = ms.students.find((s) => s.name === '김지윤');
    console.log('LETTER 김지윤 answers.len=', st?.answers.length, 'answers=', JSON.stringify(st?.answers));
  }, 60000);

  it('case B: 정답행 토큰이 헤더처럼 병합되면 해당 문항들이 모두 사라진다', async () => {
    const words = await pdfWords(PDF);
    const ansY = words.find((w) => w.str.trim() === '정답')!.y;
    // 문항 10~25의 정답 토큰(x>=210)을 헤더 "10 11 ... 25"@x=211.1 처럼 하나로 병합
    const targets = words.filter((w) => Math.abs(w.y - ansY) < 1 && w.x >= 210 && w.x < 395 && /^\d+$/.test(w.str.trim()));
    const mergedStr = targets.sort((a, b) => a.x - b.x).map((w) => w.str.trim()).join(' ');
    const merged: PdfWord = { str: mergedStr, x: 213.1, y: targets[0].y, x1: 390.9, y1: targets[0].y1, page: 1 };
    const rest = words.filter((w) => !targets.includes(w));
    const ms = parseMarksheetPdf([...rest, merged], 'merged');
    console.log('MERGED nQuestions=', ms.nQuestions, 'answerKey=', JSON.stringify(ms.answerKey));
  }, 60000);

  it('case C: 고정 밴드(106.4~392.5)에 40문항을 개별 토큰으로 재배치하면 경계(100/400)는 버틴다', async () => {
    const words = await pdfWords(PDF);
    const ansY = words.find((w) => w.str.trim() === '정답')!.y;
    const old = words.filter((w) => Math.abs(w.y - ansY) < 1 && w.x > 100 && w.x < 400 && /^\d+$/.test(w.str.trim()));
    const rest = words.filter((w) => !old.includes(w));
    const N = 40, band0 = 106.4, pitch = 286.1 / N;
    const synth: PdfWord[] = Array.from({ length: N }, (_, i) => {
      const cx = band0 + pitch * (i + 0.5);
      return { str: String((i % 5) + 1), x: cx - 2, y: ansY, x1: cx + 2, y1: ansY + 7, page: 1 };
    });
    const ms = parseMarksheetPdf([...rest, ...synth], 'forty');
    console.log('FORTY nQuestions=', ms.nQuestions, 'first/last center 포함 여부 확인용 answerKey.len=', ms.answerKey.length);
    expect(ms.nQuestions).toBe(40);
  }, 60000);
});

describe('정오표 XLSX 스케일 가정 (임시)', () => {
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
    console.log('XLSX45 n=', ms.nQuestions, 'total=', ms.students[0].total, 'scoreMax=', JSON.stringify(ms.scoreMax));
    expect(ms.nQuestions).toBe(45);
    expect(ms.students[0].total).toBe(100);
    expect(ms.students[0].answers).toHaveLength(45);
  });
});
