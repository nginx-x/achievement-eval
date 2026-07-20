// 숭인 NEIS 'xls data' 포맷 검증 — 기존 xlsx 파서가 그대로 처리하는지.
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { sheetRows, buildDataset, analyze } from '../index';
import { CORRECT_MARK } from '../config';

const dir = path.resolve(process.cwd(), 'example_data', '숭인');
const rows = (f: string) => sheetRows(new Uint8Array(fs.readFileSync(path.join(dir, f))));

describe('숭인 xls data (NEIS Excel, 25문항)', () => {
  const infoRows = rows('download-91631650018431603.xlsx');
  const marks = ['download-91631548285547327.xlsx', 'download-91631559043574646.xlsx', 'download-91631573174977428.xlsx'];
  const { info, dataset, issues } = buildDataset(infoRows, marks.map((f) => ({ rows: rows(f), name: f })));
  const result = analyze(dataset);

  it('문항정보표: 25문항 파싱, 노이즈행/줄바꿈 처리', () => {
    expect(info.items.length).toBe(25);
    // 14번: 줄바꿈으로 '분석한' + '다.' 재조립
    const q14 = info.items.find((x) => x.qno === 14)!;
    expect(q14.standard).toContain('분석한다');
    // 난이도 분포 어려움7/보통11/쉬움7 (문항정보표 하단 총합계와 일치)
    const c = (d: string) => info.items.filter((x) => x.difficulty === d).length;
    expect([c('어려움'), c('보통'), c('쉬움')]).toEqual([7, 11, 7]);
  });

  it('정오표: 검증 차단 없음, 반별 병합, 총점 재구성', () => {
    expect(issues.filter((i) => i.severity === '차단')).toHaveLength(0);
    expect(dataset.students.length).toBeGreaterThan(50);
    // 총점 재구성('.'=정답, 100 만점)
    let ok = 0;
    for (const s of dataset.students) {
      const missed = s.answers.reduce((sum, a, i) => sum + (a.trim() === CORRECT_MARK ? 0 : dataset.points[i]), 0);
      if (Math.abs(100 - missed - s.total) < 1e-6) ok++;
    }
    expect(ok).toBe(dataset.students.length);
  });

  it('분석 산출: α·성취수준·문항지표 정상', () => {
    expect(result.nQuestions).toBe(25);
    expect(result.reliability.alpha).toBeGreaterThan(0.5);
    expect(result.items).toHaveLength(25);
  });
});
