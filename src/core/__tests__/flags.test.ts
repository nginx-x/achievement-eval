import { describe, expect, it } from 'vitest';
import { computeItemFlags, statsUtil, type LevelRate } from '../index';

const flags = (pByLevel: LevelRate[], discrimination = 0.4) => computeItemFlags({ p: 0.5, discrimination, difficulty: '미상', pByLevel });
const groups = (upper: number, lower: number, n: number): LevelRate[] => [{ level: 'A', n, p: upper }, { level: 'E', n, p: lower }];

describe('표본과 효과크기를 고려한 검토 신호', () => {
  it('각 1명, 0% 대 100%에서도 불확실성이 사라지지 않는다', () => {
    const ci = statsUtil.propDiffCI(1, 1, 0, 1);
    expect(ci.lo).toBeLessThan(0);
    expect(ci.hi).toBeGreaterThan(0);
    expect(flags(groups(0, 1, 1))).toEqual([expect.objectContaining({ code: 'REVERSAL_WEAK', level: '점검', message: expect.stringContaining('표본 부족') })]);
  });

  it('최소 인원 미만이면 큰 역전도 심각·유의로 판정하지 않는다', () => {
    const result = flags(groups(0, 1, 14));
    expect(result.some(f => f.level === '심각' || f.code === 'REVERSAL')).toBe(false);
    expect(result[0].message).toContain('표본 부족');
  });

  it('대표본에서 유의하더라도 10%p 미만 차이는 심각으로 올리지 않는다', () => {
    expect(statsUtil.propDiffCI(0.52, 10000, 0.5, 10000).lo).toBeGreaterThan(0);
    expect(flags(groups(0.5, 0.52, 10000)).some(f => f.level === '심각')).toBe(false);
  });

  it('표본·10%p 효과크기·신뢰구간 조건을 모두 만족하면 역전 신호를 올린다', () => {
    expect(flags(groups(0.2, 0.8, 50))).toContainEqual(expect.objectContaining({ code: 'REVERSAL', level: '심각' }));
  });

  it.each([-0.00001, -0.4])('음의 변별도 %s만으로 결함을 심각 판정하지 않는다', discrimination => {
    expect(flags([], discrimination)).toEqual([expect.objectContaining({ code: 'NEG_DISC', level: '점검' })]);
  });

  it('비율차 신뢰구간은 집단을 바꾸면 부호가 대칭이고 가능한 범위 안에 있다', () => {
    const a = statsUtil.propDiffCI(0.7, 30, 0.4, 20), b = statsUtil.propDiffCI(0.4, 20, 0.7, 30);
    expect(a.lo).toBeCloseTo(-b.hi, 12);
    expect(a.hi).toBeCloseTo(-b.lo, 12);
    expect(a.lo).toBeGreaterThanOrEqual(-1);
    expect(a.hi).toBeLessThanOrEqual(1);
  });

  it('중간 수준이 없는 A·C를 인접 수준으로 취급하지 않는다', () => {
    expect(flags([{ level: 'A', n: 10, p: 0 }, { level: 'C', n: 10, p: 1 }]).some(f => f.code === 'NONMONOTONE')).toBe(false);
  });

  it.each([{ n: 4, upper: 0.2, lower: 0.8 }, { n: 20, upper: 0.5, lower: 0.55 }])('인접 역전도 최소 인원·15%p 기준을 적용한다: %j', ({ n, upper, lower }) => {
    expect(flags([{ level: 'B', n, p: upper }, { level: 'C', n, p: lower }]).some(f => f.code === 'NONMONOTONE')).toBe(false);
  });

  it('충분한 인원·차이가 있는 실제 인접 역전은 점검 표시한다', () => {
    expect(flags([{ level: 'B', n: 20, p: 0.2 }, { level: 'C', n: 20, p: 0.8 }])).toContainEqual(expect.objectContaining({ code: 'NONMONOTONE', level: '점검' }));
  });
});
