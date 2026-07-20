// 서답형(부분점수) 골든 테스트 — 영어 예시(선택형 25 + 서답형 3, 5반 128명).
// 문항정보표 PDF + 반별 정오표 xlsx 5개를 실제 파이프라인으로 검증.
import { describe, it, expect, beforeAll } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { sheetRows, buildDatasetFrom, analyze, parseItemInfo, parseItemInfoPdf, parseMarksheet } from '../index';
import type { PdfWord } from '../parse/pdfTypes';
import type { AnalysisResult, ItemInfoTable } from '../types';

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

describe('서답형 골든 (영어 예시)', () => {
  const dir = path.resolve(process.cwd(), 'example_data/서답형');
  let info: ItemInfoTable;
  let result: AnalysisResult;
  let issues: { severity: string; code: string }[];

  beforeAll(async () => {
    info = parseItemInfoPdf(await pdfWords(path.join(dir, '문항정보표.pdf')));
    const sheets = ['1반', '2반', '3반', '4반', '5반'].map((c) =>
      parseMarksheet(sheetRows(new Uint8Array(fs.readFileSync(path.join(dir, `${c}.xlsx`)))), `${c}.xlsx`));
    const built = buildDatasetFrom(info, sheets);
    issues = built.issues;
    result = analyze(built.dataset);
  }, 60000);

  it('문항정보표 PDF: 선택형 25 + 서답형 3 분리', () => {
    expect(info.items.length).toBe(25);
    expect(info.consItems.length).toBe(3);
    expect(info.items.every((i) => i.type === '선택형')).toBe(true);
    expect(info.consItems.every((i) => i.type === '서답형')).toBe(true);
    // 서답형 배점 3/3/4
    expect(info.consItems.map((i) => i.points)).toEqual([3, 3, 4]);
  });

  it('문항정보표 xlsx: PDF와 동일 결과(교차검증)', () => {
    const x = parseItemInfo(sheetRows(new Uint8Array(fs.readFileSync(path.join(dir, '문항정보표.xlsx')))));
    expect(x.subject).toBe('영어');
    expect(x.items.length).toBe(25);
    expect(x.consItems.length).toBe(3);
    expect(x.items.map((i) => i.answer)).toEqual(info.items.map((i) => i.answer));
    expect(x.items.map((i) => i.points)).toEqual(info.items.map((i) => i.points));
    expect(x.consItems.map((i) => i.points)).toEqual([3, 3, 4]);
    expect(x.consItems.every((i) => i.answer == null && i.type === '서답형')).toBe(true);
  });

  it('정오표: 5반 128명, 서답형 배점 10점 인식', () => {
    expect(result.nStudents).toBe(128);
    expect(result.constructed).not.toBeNull();
    expect(result.constructed!.maxPoints).toBe(10);
  });

  it('검증: 차단 0 + 점수 정합(선택형 재구성+서답형+기타=총점) 경고 0', () => {
    expect(issues.filter((i) => i.severity === '차단')).toHaveLength(0);
    expect(issues.filter((i) => i.code === 'SCORE_SUM_MISMATCH')).toHaveLength(0);
    expect(issues.filter((i) => i.code === 'SEL_RECON_MISMATCH')).toHaveLength(0);
    expect(issues.filter((i) => i.code === 'CONS_POINTS_MISMATCH')).toHaveLength(0);
  });

  it('서답형 분석: 획득률·변별도·수준별 단조', () => {
    const c = result.constructed!;
    expect(c.min).toBe(0);
    expect(c.max).toBe(10);
    expect(c.mean).toBeCloseTo(4.4, 1);
    expect(c.rate).toBeCloseTo(0.44, 2);
    // KICE 방식의 강한 양의 변별도
    expect(c.discrimination).toBeGreaterThan(0.5);
    // 성취수준별 획득률 단조 감소(A ≥ B ≥ ... ≥ E)
    const rates = c.byLevel.filter((b) => b.rate != null).map((b) => b.rate!);
    for (let i = 1; i < rates.length; i++) expect(rates[i]).toBeLessThanOrEqual(rates[i - 1] + 1e-9);
    // 부분점수 분포 비율 합 ≈ 1
    const sum = c.scoreDist.reduce((a, d) => a + d.ratio, 0);
    expect(sum).toBeCloseTo(1, 5);
  });

  it('신뢰도 α: 서답형 의사문항 포함(총점 정합)', () => {
    // α 계산되고 유효 범위
    expect(Number.isFinite(result.reliability.alpha)).toBe(true);
    expect(result.reliability.alpha).toBeGreaterThan(0.8);
    // k = 선택형 25 + 서답형 의사문항 1 = 26
    expect(result.reliability.k).toBe(26);
  });
});
