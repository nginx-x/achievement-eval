// 골든 테스트 — 실제 예시데이터(3학년 사회 기말, 130명·31문항)로 core 전체 검증.
// 기대값은 라이브 앱 v2.1.0 출력과 상호검증된 값(α 0.916, A54.., 변별도 문1 0.513).
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { sheetRows, buildDataset, analyze } from '../index';
import { CORRECT_MARK } from '../config';

function loadExample() {
  const dir = path.resolve(process.cwd(), 'example_data');
  const files = fs
    .readdirSync(dir)
    .filter((f) => f.toLowerCase().endsWith('.xlsx'))
    .map((f) => path.join(dir, f))
    .sort((a, b) => fs.statSync(a).size - fs.statSync(b).size);
  const infoRows = sheetRows(new Uint8Array(fs.readFileSync(files[0]))); // 작은 파일 = 문항정보표
  const markRows = sheetRows(new Uint8Array(fs.readFileSync(files[1]))); // 큰 파일 = 정오표
  return { infoRows, markRows };
}

describe('core 골든 테스트 (예시데이터)', () => {
  const { infoRows, markRows } = loadExample();
  const { info, dataset, issues } = buildDataset(infoRows, [{ rows: markRows, name: '정오표' }]);
  const result = analyze(dataset);

  it('문항정보표: 31문항 파싱, 11번 줄바꿈 재조립', () => {
    expect(info.items.length).toBe(31);
    const q11 = info.items.find((x) => x.qno === 11)!;
    // R20에서 잘리고 R22로 이어진 내용영역이 재조립되어야 함
    expect(q11.area).toContain('노인 인구');
    expect(q11.area).toContain('추론'); // R22 연속행 '…추론하기'
    // 예상난이도 분포 4/17/10
    const byDiff = (d: string) => info.items.filter((x) => x.difficulty === d).length;
    expect(byDiff('어려움')).toBe(4);
    expect(byDiff('보통')).toBe(17);
    expect(byDiff('쉬움')).toBe(10);
  });

  it('정오표: 5반 130명, 검증 차단 없음', () => {
    expect(dataset.students.length).toBe(130);
    expect(dataset.classes).toEqual(['1', '2', '3', '4', '5']);
    expect(issues.filter((i) => i.severity === '차단')).toHaveLength(0);
  });

  it("'.'=정답: 총점 재구성 130/130 일치", () => {
    let ok = 0;
    for (const s of dataset.students) {
      const missed = s.answers.reduce((sum, a, i) => sum + (a.trim() === CORRECT_MARK ? 0 : dataset.points[i]), 0);
      if (Math.abs(100 - missed - s.total) < 1e-6) ok++;
    }
    expect(ok).toBe(130);
  });

  it('신뢰도 α ≈ 0.916', () => {
    expect(result.reliability.alpha).toBeCloseTo(0.916, 2);
  });

  it('성취수준 분포 A54/B24/C17/D9/E26, 평균 77.9', () => {
    const dist = Object.fromEntries(result.achievement.distribution.map((d) => [d.level, d.n]));
    expect(dist).toEqual({ A: 54, B: 24, C: 17, D: 9, E: 26 });
    expect(result.achievement.overall.mean).toBeCloseTo(77.9, 1);
    expect(result.achievement.overall.sd).toBeCloseTo(23.0, 0);
  });

  it('문항 지표: 문1 비교정 변별도 0.513(앱 일치), 정답률 0.669', () => {
    const q1 = result.items.find((x) => x.qno === 1)!;
    expect(q1.discrimination).toBeCloseTo(0.513, 2);
    expect(q1.p).toBeCloseTo(0.669, 2);
  });

  it('예상난이도 정합성: τ-b 계산되고 Q15가 불일치로 검출', () => {
    expect(result.expectedVsActual.tauB).not.toBeNull();
    expect(result.expectedVsActual.tauB!).toBeGreaterThan(0);
    const m = result.expectedVsActual.mismatches.find((x) => x.qno === 15);
    expect(m).toBeTruthy();
    expect(m!.reason).toContain('쉬웠');
  });

  it('성취기준 롤업 생성 (취약=성취율 오름차순, 수준별 성취율 A~E)', () => {
    expect(result.standards.length).toBeGreaterThan(0);
    const ars = result.standards.map((s) => s.achievementRate);
    expect([...ars]).toEqual([...ars].sort((a, b) => a - b));
    expect(result.standards[0].achievementByLevel).toHaveLength(5);
  });

  it('신규 지표: SEM · 수준×보기 교차표 · 반별 상세 · 반별 문항정답률', () => {
    // SEM = SD·√(1−α) > 0
    expect(result.reliability.sem).toBeGreaterThan(0);
    expect(Number.isFinite(result.reliability.sem)).toBe(true);
    // 문항 A2 교차표: 문1의 성취수준별 보기 분포 5개, 보기 비율 합 ≈ 1
    const q1 = result.items.find((x) => x.qno === 1)!;
    expect(q1.distractorByLevel).toHaveLength(5);
    const aRow = q1.distractorByLevel.find((r) => r.level === 'A')!;
    const sum = Object.values(aRow.dist).reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(1, 5);
    // 반별 상세: 평균·표준편차, 반별 문항 정답률
    expect(result.achievement.byClass).toHaveLength(5);
    expect(result.achievement.byClass[0].mean).toBeGreaterThan(0);
    expect(result.classItemRates).toHaveLength(5);
    expect(result.classItemRates[0].rates).toHaveLength(31);
  });

  it('이름 유지(로컬): 학생에 name·id 존재', () => {
    expect(dataset.students[0].name).toBeTruthy();
    expect(dataset.students[0].id).toBeTruthy();
  });

  it('경계 결정 문항 + 대표문항(경계문항) — 강의원고 35~39p', () => {
    const q = (n: number) => result.items.find((x) => x.qno === n)!;
    expect(q(1).levelGaps.map((g) => g.boundary)).toEqual(['A/B', 'B/C', 'C/D', 'D/E']);
    // 대표문항 정의: 그 수준 정답률 ≥ 2/3
    for (const it of result.items) {
      for (const lv of it.representsLevels) {
        expect(it.pByLevel.find((r) => r.level === lv)!.p!).toBeGreaterThanOrEqual(2 / 3 - 1e-9);
      }
    }
    // 문4(E 76.9%)는 E 대표문항, 경계 결정 문항 1개 이상 존재
    expect(q(4).representsLevels).toContain('E');
    expect(result.items.some((it) => it.decidesBoundary != null)).toBe(true);
  });

  it('위험 요약 내러티브 생성', () => {
    expect(result.risk.narrative).toContain('문항 중');
    expect(result.risk.narrative).toContain('α');
  });
});
