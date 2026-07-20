import { useEffect, useMemo, useState } from 'react';
import { config, formatResponseCode, type ItemStat, type LevelOptionDist } from '@core/index';
import { FORMAT, responseCellBackground } from '../lib/ui';

const OPTIONS = ['1', '2', '3', '4', '5'];

function responseLabel(code: string): string {
  if (code === config.NO_RESPONSE) return '무응답';
  if (code === config.OTHER_RESPONSE) return '기타/오류';
  return formatResponseCode(code);
}

function selectionRows(item: ItemStat, nStudents: number): Array<LevelOptionDist | { level: '전체'; n: number; dist: Record<string, number> }> {
  if (!item.multiAnswer) return [];
  return [
    ...item.multiAnswer.optionSelectionByLevel,
    { level: '전체', n: nStudents, dist: item.multiAnswer.optionSelection },
  ];
}

export function MultiAnswerResponse({ item, nStudents }: { item: ItemStat; nStudents: number }) {
  const [expanded, setExpanded] = useState(false);
  useEffect(() => setExpanded(false), [item.qno]);

  const multi = item.multiAnswer;
  const combinations = useMemo(() => {
    if (!multi) return [];
    return Object.entries(multi.combination)
      .filter(([, rate]) => rate > 0)
      .sort(([a, ar], [b, br]) => {
        if (a === multi.answerCode) return -1;
        if (b === multi.answerCode) return 1;
        return br - ar;
      });
  }, [multi]);

  if (!multi) return null;
  const visible = expanded ? combinations : combinations.slice(0, 4);
  const maxRate = Math.max(...combinations.map(([, rate]) => rate), 0.01);
  const correctSet = new Set(multi.answerOptions.map(String));
  const rows = selectionRows(item, nStudents);

  return (
    <div className="multi-response">
      <section className="multi-section">
        <h4 className="sub">조합별 응답분포 <span className="muted sm">(정확히 같은 조합끼리 집계)</span></h4>
        <div className="combo-list">
          {visible.map(([code, rate]) => {
            const correct = code === multi.answerCode;
            return (
              <div className={`combo-row${correct ? ' correct' : ''}`} key={code}>
                <div className="combo-label">{responseLabel(code)}{correct && <span className="answer-tag">정답</span>}</div>
                <div className="combo-bar"><span style={{ width: `${(rate / maxRate) * 100}%` }} /></div>
                <div className="combo-value"><b>{FORMAT.p(rate)}</b><span>{Math.round(rate * nStudents)}명</span></div>
              </div>
            );
          })}
        </div>
        {combinations.length > 4 && (
          <button className="btn-ghost sm combo-more" onClick={() => setExpanded((value) => !value)}>
            {expanded ? '상위 응답만 보기' : `나머지 ${combinations.length - 4}개 조합 보기`}
          </button>
        )}
      </section>

      <section className="multi-section">
        <h4 className="sub">선택지별 선택률 <span className="muted sm">(각 선택지를 포함한 학생 비율)</span></h4>
        <div className="tbl-scroll">
          <table className="tbl compact option-selection">
            <thead>
              <tr>
                <th>수준</th>
                {OPTIONS.map((option) => <th className={correctSet.has(option) ? 'corr' : ''} key={option}>{option}</th>)}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.level} className={row.level === '전체' ? 'total-row' : ''}>
                  <td>{row.level} <span className="muted sm">n{row.n}</span></td>
                  {OPTIONS.map((option) => {
                    const rate = row.dist[option] ?? 0;
                    return (
                      <td
                        className={correctSet.has(option) ? 'corr' : ''}
                        key={option}
                        style={{ background: responseCellBackground(rate, correctSet.has(option)) }}
                      >
                        {rate > 0 ? Math.round(rate * 100) : '·'}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="multi-note">한 학생이 여러 선택지에 포함되므로 행의 합계는 100%를 넘을 수 있습니다.</p>
      </section>
    </div>
  );
}
