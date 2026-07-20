import { useStore } from '../state/store';
import { LEVELS, config, type ItemStat } from '@core/index';
import { Help } from './Help';

const BOUNDS = ['A/B', 'B/C', 'C/D', 'D/E'];
const pct = (v: number | null | undefined) => Math.round((v ?? 0) * 100);

export function LevelBoundary() {
  const result = useStore((s) => s.result)!;
  const selectQ = useStore((s) => s.selectQ);
  const items = result.items;

  const deciders = BOUNDS.map((b) => ({
    boundary: b,
    items: items
      .filter((it) => it.decidesBoundary?.boundary === b)
      .sort((a, c) => c.decidesBoundary!.gap - a.decidesBoundary!.gap),
  }));
  const reps = LEVELS.map((lv) => ({ level: lv, items: items.filter((it) => it.representsLevels.includes(lv)) }));
  const unclassified = items.filter((it) => it.representsLevels.length === 0);

  const gapChip = (it: ItemStat) => {
    const g = it.levelGaps.find((x) => x.boundary === it.decidesBoundary!.boundary)!;
    return (
      <button key={it.qno} className="lb-chip" onClick={() => selectQ(it.qno)}>
        Q{it.qno} <span className="lb-sub">{pct(g.upperP)}%→{pct(g.lowerP)}% <b>−{Math.round(it.decidesBoundary!.gap * 100)}%p</b></span>
      </button>
    );
  };

  return (
    <div className="card">
      <h3>성취수준 경계 분석 <Help>① 인접 성취수준(A/B·B/C·C/D·D/E) 사이 정답률 격차가 큰 문항 = 그 경계를 잘 구분하는 문항. ② 대표문항(경계문항) = 해당 수준의 약 2/3(≈66.7%) 이상이 맞고, 바로 아래 수준에서는 2/3 미만이 되는 문항 — 그 수준 학생이 "할 수 있는 것"을 대표. (강의원고 35~39p 기준)</Help></h3>

      <h4 className="sub">① 경계를 결정짓는 문항 <span className="muted sm">(인접 수준 정답률 격차 ≥ 25%p)</span></h4>
      <div className="lb-grid">
        {deciders.map((d) => (
          <div key={d.boundary} className="lb-row">
            <span className="lb-bound">{d.boundary}</span>
            <div className="lb-chips">
              {d.items.length ? d.items.map(gapChip) : <span className="muted sm">해당 없음</span>}
            </div>
          </div>
        ))}
      </div>

      <h4 className="sub">② 성취수준별 대표문항 <span className="muted sm">(해당 수준 ≥ 2/3, 바로 아래 &lt; 2/3 · 경계문항)</span></h4>
      <div className="lb-grid">
        {reps.map((r) => (
          <div key={r.level} className="lb-row">
            <span className="lb-bound"><span className="lvl-dot" style={{ background: config.LEVEL_COLORS[r.level] }} />{r.level}</span>
            <div className="lb-chips">
              {r.items.length
                ? r.items.map((it) => <button key={it.qno} className="lb-chip rep" onClick={() => selectQ(it.qno)}>Q{it.qno}</button>)
                : <span className="muted sm">없음</span>}
            </div>
          </div>
        ))}
      </div>

      <h4 className="sub">③ 미분류 문항 <span className="muted sm">(어느 수준의 대표문항도 아님 — 최상위 수준도 2/3 미만인 경우)</span></h4>
      <div className="lb-grid">
        <div className="lb-row">
          <span className="lb-bound">—</span>
          <div className="lb-chips">
            {unclassified.length
              ? unclassified.map((it) => <button key={it.qno} className="lb-chip warn" onClick={() => selectQ(it.qno)}>Q{it.qno}</button>)
              : <span className="muted sm">없음 (모든 문항이 어느 한 수준을 대표함)</span>}
          </div>
        </div>
      </div>
    </div>
  );
}
