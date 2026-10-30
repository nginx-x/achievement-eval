import { beforeEach, describe, expect, it, vi } from 'vitest';
import { analyze, type ItemInfoTable, type Marksheet } from '@core/index';
import type { Recognition } from '../lib/recognize';
import { useStore } from './store';

vi.mock('@core/index', async (original) => {
  const actual = await original<typeof import('@core/index')>();
  return { ...actual, analyze: vi.fn(actual.analyze) };
});

const info: ItemInfoTable = {
  subject: '합성', grade: '3', examName: '기말고사', totalScore: 100, consItems: [],
  items: [1, 2].map(qno => ({ qno, area: '', standard: '', difficulty: '미상', points: 50, answer: null, type: '선택형' })),
};
function sheet(classId: string): Marksheet {
  return { meta: { classId }, answerKey: ['1', '2'], points: [50, 50], nQuestions: 2,
    scoreMax: { sel: 100, cons: 0, etc: 0 }, sourceName: `${classId}반.pdf`,
    students: [{ classId, seat: '1', name: '', studentId: '', answers: ['.', '.'], total: 100, scores: { sel: 100, cons: 0, etc: 0 } }] };
}
function recs(second: Marksheet, itemInfo = info): Recognition[] {
  return [
    { file: new File([], '문항정보표.pdf'), role: 'info', label: '', info: itemInfo },
    ...[sheet('1'), second].map(s => ({ file: new File([], s.sourceName), role: 'marks' as const, label: '', sheet: s })),
  ];
}

describe('불일치 안내 후 사용자가 선택한 경우에만 분석', () => {
  beforeEach(() => { useStore.getState().reset(); vi.mocked(analyze).mockClear(); });

  it('일치하는 파일은 바로 분석한다', () => {
    useStore.getState().loadRecognized(recs(sheet('2')));
    expect(useStore.getState().status).toBe('ready');
    expect(useStore.getState().issues).toEqual([]);
    expect(analyze).toHaveBeenCalledTimes(1);
  });

  it.each(['key', 'points', 'questions', 'info', 'extraInfo'] as const)('%s 불일치는 확인 전 계산하지 않고 확인 후 경고를 남겨 분석한다', kind => {
    const second = sheet('2');
    if (kind === 'key') second.answerKey[0] = '3';
    if (kind === 'points') second.points = [40, 60];
    if (kind === 'questions') second.nQuestions = 3;
    const alteredInfo = kind === 'info' ? { ...info, items: info.items.slice(0, 1) }
      : kind === 'extraInfo' ? { ...info, items: [...info.items, { ...info.items[0], qno: 3 }] } : info;
    const inputs = recs(second, alteredInfo);
    useStore.getState().loadRecognized(inputs);
    expect(analyze).not.toHaveBeenCalled();
    expect(useStore.getState().result).toBeUndefined();
    expect(useStore.getState().status).toBe('empty');
    expect(useStore.getState().issues.some(i => i.severity === '차단')).toBe(true);

    useStore.getState().loadRecognized(inputs, { allowConflicts: true });
    expect(useStore.getState().status).toBe('ready');
    expect(analyze).toHaveBeenCalledTimes(1);
    expect(useStore.getState().issues.some(i => i.severity === '차단')).toBe(true);
    expect(useStore.getState().result!.items).toHaveLength(2);
    expect(useStore.getState().result!.items.every(item => Number.isFinite(item.points))).toBe(true);
  });

  it('앞선 분석에서 허용했어도 다음 입력에 확인을 자동 적용하지 않는다', () => {
    const second = sheet('2'); second.answerKey[0] = '3';
    useStore.getState().loadRecognized(recs(second), { allowConflicts: true });
    vi.mocked(analyze).mockClear();
    useStore.getState().loadRecognized(recs(second));
    expect(analyze).not.toHaveBeenCalled();
    expect(useStore.getState().dataset).toBeUndefined();
    expect(useStore.getState().result).toBeUndefined();
  });
});
