import { useStore } from '../state/store';
import { severityOf } from '../lib/ui';
import { config, type FlagLevel } from '@core/index';

const LEVELS: FlagLevel[] = ['심각', '주의', '점검'];

export function RiskCard() {
  const result = useStore((s) => s.result)!;
  const selectQ = useStore((s) => s.selectQ);
  const { risk } = result;

  return (
    <div className="card risk-card">
      <h3>이번 시험에서 봐야 할 것</h3>
      <p className="narrative">{risk.narrative}</p>

      <div className="sev-chips">
        {LEVELS.map((lv) => {
          const t = config.SEVERITY[lv];
          return (
            <span key={lv} className="sev-chip" style={{ borderColor: t.color }}>
              <span className="sev-shape" style={{ color: t.color }}>{t.shape}</span> {lv} <b>{risk.counts[lv]}</b>
            </span>
          );
        })}
      </div>

      {risk.flaggedItems.length > 0 ? (
        <ul className="flag-list">
          {risk.flaggedItems.map((fi) => {
            const t = severityOf(fi.flags);
            return (
              <li key={fi.qno}>
                <button className="link" onClick={() => selectQ(fi.qno)}>
                  <span className="sev-shape" style={{ color: t.color }}>{t.shape}</span> Q{fi.qno}
                </button>
                <span className="muted"> — {fi.flags[0].message}</span>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="muted">🟢 위험·주의·점검으로 표시된 문항이 없습니다. 전반적으로 양호한 시험입니다.</p>
      )}
    </div>
  );
}
