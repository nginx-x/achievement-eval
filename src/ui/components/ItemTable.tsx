import { useStore } from '../state/store';
import {
  applyFilters, sortItems, severityOf, diagLabel, ITEM_FILTERS, FORMAT,
  bgDifficulty, bgCorrectRate, bgDiscrimination, bgLevel,
} from '../lib/ui';
import type { LevelRate } from '@core/index';
import { config } from '@core/index';
import { Help } from './Help';

function LevelCells({ rates }: { rates: LevelRate[] }) {
  return (
    <div className="levelcells">
      {rates.map((r) => (
        <span key={r.level} className="lc" title={`${r.level}: ${r.p != null ? FORMAT.p(r.p) : '—'} (n${r.n})`}
          style={{ background: bgLevel(r.p) }}>
          {r.p != null ? Math.round(r.p * 100) : '·'}
        </span>
      ))}
    </div>
  );
}

export function ItemTable() {
  const result = useStore((s) => s.result)!;
  const filters = useStore((s) => s.filters);
  const sort = useStore((s) => s.sort);
  const toggleFilter = useStore((s) => s.toggleFilter);
  const clearFilters = useStore((s) => s.clearFilters);
  const setSort = useStore((s) => s.setSort);
  const selectQ = useStore((s) => s.selectQ);
  const selectedQ = useStore((s) => s.selectedQ);

  const rows = sortItems(applyFilters(result.items, filters), sort);
  const ind = (k: string) => (sort?.key === k ? (sort.dir === 'desc' ? ' ▼' : ' ▲') : '');
  // 정답률 3색 색조는 전체 문항의 min~max 로 정규화(필터와 무관하게 안정적)
  const ps = result.items.map((i) => i.p);
  const pMin = Math.min(...ps), pMax = Math.max(...ps);
  const activeLabels = ITEM_FILTERS.filter((f) => filters.includes(f.code)).map((f) => f.label);

  return (
    <>
      <div className="filter-bar">
        {ITEM_FILTERS.map((f) => (
          <button key={f.code} className={`chip${filters.includes(f.code) ? ' on' : ''}`} onClick={() => toggleFilter(f.code)}>
            {f.label} <b>{result.items.filter(f.test).length}</b>
          </button>
        ))}
        <span className="filter-summary">
          <b>{rows.length}</b> / {result.items.length}문항
          {activeLabels.length > 0 && <span className="muted"> · {activeLabels.join(' + ')}</span>}
        </span>
        {filters.length > 0 && <button className="btn-ghost sm" onClick={clearFilters}>필터 초기화</button>}
        <span className="diff-legend">
          <i style={{ background: bgDifficulty('쉬움') }} />쉬움
          <i style={{ background: bgDifficulty('보통') }} />보통
          <i style={{ background: bgDifficulty('어려움') }} />어려움
        </span>
      </div>

      <div className="tbl-scroll">
        <table className="tbl items grid">
          <thead>
            <tr>
              <th className="sortable sticky-col" onClick={() => setSort('qno')}>문항{ind('qno')}</th>
              <th>예상</th>
              <th className="sortable" onClick={() => setSort('p')}>정답률{ind('p')} <Help>정답자/응시자. 준거참조(성취평가)에서 높은 정답률은 결함이 아니라 성취 도달 신호일 수 있습니다. 변별 관점에선 0.90 초과 시 변별 기여가 낮습니다.</Help></th>
              <th className="sortable" onClick={() => setSort('disc')}>변별도{ind('disc')} <Help>KICE 원본 앱과 같은 비교정 문항-총점 상관(해당 문항을 포함한 총점). 0.30↑ 양호, 0.20 미만 미흡, 음수는 정답/문항 점검 대상입니다.</Help></th>
              <th>진단</th>
              <th>성취수준별 정답률(A~E) <Help>수준 집단별 정답률(%). 2/3(약 67%) 미만 셀은 회색. 상위 수준이 하위보다 낮으면(역전) 진단 열에 플래그됩니다.</Help></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((it) => {
              const t = severityOf(it.flags);
              const label = diagLabel(it.flags);
              return (
                <tr key={it.qno} className={selectedQ === it.qno ? 'sel' : ''} onClick={() => selectQ(it.qno)}>
                  <td className="num sticky-col">Q{it.qno}{it.multiAnswer && <span className="multi-mini">복수</span>}</td>
                  <td className="cell-diff" style={{ background: bgDifficulty(it.difficulty) }}>{it.difficulty}</td>
                  <td className="cell-val" style={{ background: bgCorrectRate(it.p, pMin, pMax) }}>{FORMAT.p(it.p)}</td>
                  <td className="cell-val" style={{ background: bgDiscrimination(it.discrimination) }}>{FORMAT.disc(it.discrimination)}</td>
                  <td className="cell-diag">
                    {it.flags.length ? (
                      <span className="diag" title={it.flags.map((f) => f.message).join('\n')}>
                        <span className="sev-shape" style={{ color: t.color }}>{t.shape}</span> {label}
                        {it.flags.length > 1 && <sup>+{it.flags.length - 1}</sup>}
                      </span>
                    ) : (
                      <span className="ok-mark" style={{ color: config.SEVERITY['양호'].color }} title="양호">—</span>
                    )}
                  </td>
                  <td><LevelCells rates={it.pByLevel} /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
