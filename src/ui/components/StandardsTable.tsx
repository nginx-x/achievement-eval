import { useStore } from '../state/store';
import { FORMAT } from '../lib/ui';
import { SHADING, LEVEL_COLORS } from '@core/config';
import { LEVELS } from '@core/index';
import { Help } from './Help';

export function StandardsTable() {
  const result = useStore((s) => s.result)!;
  return (
    <div className="card">
      <h3>성취기준 분석 <span className="muted sm">(취약 순)</span> <Help>성취율 = 배점가중 획득률(Σ 정답률×배점 / Σ배점). 수준별(A~E)은 각 집단의 배점가중 성취율. 50% 이하 셀은 회색.</Help></h3>
      <div className="tbl-scroll">
        <table className="tbl compact">
          <thead>
            <tr>
              <th className="std-col">성취기준</th>
              <th className="num">문항</th>
              <th className="num">배점</th>
              <th className="num">성취율</th>
              {LEVELS.map((lv) => (
                <th key={lv} className="num"><span className="lvl-dot" style={{ background: LEVEL_COLORS[lv] }} />{lv}</th>
              ))}
              <th className="num">변별도 <Help>KICE 원본 앱과 같은 비교정 문항-총점 상관의 평균입니다.</Help></th>
            </tr>
          </thead>
          <tbody>
            {result.standards.map((s, i) => (
              <tr key={i} className={s.achievementRate <= SHADING.STANDARD ? 'row-weak' : ''}>
                <td className="std-col" title={s.standard}>{s.standard}</td>
                <td className="num">{s.nItems}</td>
                <td className="num">{s.totalPoints}</td>
                <td className="num"><b>{FORMAT.p(s.achievementRate)}</b></td>
                {LEVELS.map((lv) => {
                  const r = s.achievementByLevel.find((x) => x.level === lv);
                  const v = r?.p;
                  return (
                    <td key={lv} className="num" style={{ background: v != null && v <= SHADING.STANDARD ? '#e2e2e2' : undefined }}>
                      {v != null ? Math.round(v * 100) : '—'}
                    </td>
                  );
                })}
                <td className="num">{FORMAT.disc(s.meanDiscrimination)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
