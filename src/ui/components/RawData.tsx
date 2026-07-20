import { useStore } from '../state/store';
import { levelOf, config } from '@core/index';

export function RawData() {
  const dataset = useStore((s) => s.dataset)!;
  const cutoffs = useStore((s) => s.cutoffs);
  const hasCons = (dataset.scoreMax?.cons ?? 0) > 0;

  return (
    <div className="card">
      <h3>학생 원자료 <span className="muted sm">({dataset.students.length}명)</span></h3>
      <div className="tbl-scroll rawdata-scroll">
        <table className="tbl compact">
          <thead>
            <tr>
              <th>반</th><th>번호</th><th>학번</th><th>이름</th>
              {hasCons && <><th className="num">선택형</th><th className="num">서답형</th></>}
              <th className="num">총점</th><th>성취수준</th>
            </tr>
          </thead>
          <tbody>
            {dataset.students.map((s, i) => {
              const lv = levelOf(s.total, cutoffs);
              return (
                <tr key={i}>
                  <td>{s.classId}</td>
                  <td>{s.seat}</td>
                  <td className="muted">{s.id}</td>
                  <td>{s.name}</td>
                  {hasCons && <><td className="num muted">{s.scores?.sel ?? '—'}</td><td className="num">{s.scores?.cons ?? '—'}</td></>}
                  <td className="num">{s.total}</td>
                  <td><span className="lvl-dot" style={{ background: config.LEVEL_COLORS[lv] }} />{lv}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
