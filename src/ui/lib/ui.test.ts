import { describe, expect, it } from 'vitest';
import { responseCellBackground } from './ui';

describe('보기 선택률 배경색', () => {
  it('선택률이 0이면 정답 여부와 관계없이 투명하다', () => {
    expect(responseCellBackground(0, true)).toBe('transparent');
    expect(responseCellBackground(0, false)).toBe('transparent');
  });

  it('정답은 초록, 오답은 빨강이며 선택률에 따라 강도가 증가한다', () => {
    expect(responseCellBackground(0.5, true)).toBe('rgba(77,146,33,0.395)');
    expect(responseCellBackground(0.5, false)).toBe('rgba(200,80,80,0.25)');
    expect(responseCellBackground(0.8, true)).not.toBe(responseCellBackground(0.2, true));
    expect(responseCellBackground(0.8, false)).not.toBe(responseCellBackground(0.2, false));
  });
});
