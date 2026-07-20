import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, ErrorBar, Cell, CartesianGrid,
} from 'recharts';
import { useStore } from '../state/store';
import { FORMAT } from '../lib/ui';
import { LEVEL_COLORS } from '@core/config';
import { LEVELS } from '@core/index';
import { Help } from './Help';

const LEVEL_TEXT_STYLE: Record<string, { color: string; textShadow: string }> = {
  A: { color: '#fffefb', textShadow: '0 0 2px rgba(0,0,0,.35)' },
  B: { color: '#fffefb', textShadow: '0 0 2px rgba(0,0,0,.35)' },
  C: { color: '#201515', textShadow: 'none' },
  D: { color: '#201515', textShadow: 'none' },
  E: { color: '#201515', textShadow: 'none' },
};

/** 성취수준 누적 가로막대 한 줄 (전체/반별 공용) */
function LevelDistRow({ label, sub, counts, n, total }: {
  label: string; sub?: string; counts: Record<string, number>; n: number; total?: boolean;
}) {
  const segments = LEVELS
    .map((lv) => ({ lv, c: counts[lv] ?? 0, w: n ? ((counts[lv] ?? 0) / n) * 100 : 0 }))
    .filter((seg) => seg.w > 0);

  return (
    <div className={`cd-row${total ? ' cd-total' : ''}`}>
      <span className="cd-label"><span>{label}</span>{sub && <span className="muted sm">{sub}</span>}</span>
      <div className="cd-stack">
        <div className="cd-bar">
          {segments.map(({ lv, c, w }) => {
            const textStyle = LEVEL_TEXT_STYLE[lv];
            return (
              <span key={lv} className="cd-seg" title={`${lv} ${c}명 (${w.toFixed(0)}%)`}
                style={{ width: `${w}%`, background: LEVEL_COLORS[lv], color: textStyle.color, textShadow: textStyle.textShadow }}>
                {lv} {c}
              </span>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export function AchievementSection() {
  const result = useStore((s) => s.result)!;
  const dataset = useStore((s) => s.dataset)!;
  const dist = result.achievement.distribution;
  const o = result.achievement.overall;
  const byClass = result.achievement.byClass;
  const rel = result.reliability;

  // 점수 히스토그램(10점 구간)
  const bins = Array.from({ length: 10 }, (_, b) => ({ label: `${b * 10}~${b === 9 ? 100 : b * 10 + 9}`, n: 0 }));
  for (const s of dataset.students) bins[Math.min(9, Math.floor(s.total / 10))].n++;

  return (
    <div className="card">
      <h3>전체 성취도 분석</h3>
      <div className="stat-row">
        <div className="stat"><span className="stat-v">{FORMAT.score(o.mean)}</span><span className="stat-l">평균</span></div>
        <div className="stat"><span className="stat-v">{FORMAT.score(o.sd)}</span><span className="stat-l">표준편차</span></div>
        <div className="stat"><span className="stat-v">{o.min}~{o.max}</span><span className="stat-l">최저~최고</span></div>
        <div className="stat"><span className="stat-v">{o.n}</span><span className="stat-l">응시자</span></div>
        <div className="stat"><span className="stat-v">{Number.isNaN(rel.alpha) ? '—' : FORMAT.alpha(rel.alpha)}</span><span className="stat-l">신뢰도 α</span></div>
        <div className="stat"><span className="stat-v">±{Number.isNaN(rel.sem) ? '—' : FORMAT.score(rel.sem)}</span><span className="stat-l">측정오차 SEM <Help>측정의 표준오차 = SD·√(1−α). 학생 원점수의 ±오차 범위. 커트라인 인접 학생의 등급 판정에 유의.</Help></span></div>
      </div>

      <div className="chart-grid achievement-grid">
        <div className="chart-box">
          <div className="chart-title">성취수준 분포 {byClass.length > 1 && <span className="muted sm">(전체·반별)</span>}</div>
          <div className="classdist">
            <LevelDistRow total label="전체" sub={`n${o.n}`} n={o.n}
              counts={Object.fromEntries(dist.map((d) => [d.level, d.n]))} />
            {byClass.length > 1 && byClass.map((c) => (
              <LevelDistRow key={c.classId} label={`${c.classId}반`}
                sub={`n${c.n} · 평균 ${FORMAT.score(c.mean)}`} counts={c.counts} n={c.n} />
            ))}
          </div>
        </div>

        <div className="chart-box">
          <div className="chart-title">수준별 평균 ± 표준편차 <Help>수준별 평균 원점수와 ±1 표준편차. 표본이 작은 수준(n 작음)은 SD 해석에 주의.</Help></div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={dist} margin={{ top: 8, right: 8, bottom: 4, left: 4 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="level" />
              <YAxis domain={[0, 105]} ticks={[0, 25, 50, 75, 100]} allowDecimals={false} allowDataOverflow />
              <Tooltip formatter={(v: number, name: string) => [FORMAT.score(v), name === 'meanRaw' ? '평균 원점수' : name]} />
              <Bar dataKey="meanRaw" name="평균 원점수" isAnimationActive={false}>
                {dist.map((d) => <Cell key={d.level} fill={LEVEL_COLORS[d.level]} />)}
                <ErrorBar dataKey="sdRaw" width={4} strokeWidth={1.5} stroke="#444" direction="y" />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="chart-box full">
        <div className="chart-title">점수 분포 <span className="muted sm">(10점 구간)</span></div>
        <ResponsiveContainer width="100%" height={170}>
          <BarChart data={bins} margin={{ top: 8, right: 8, bottom: 4, left: 4 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="label" fontSize={11} interval={0} />
            <YAxis allowDecimals={false} />
            <Tooltip formatter={(v: number) => [`${v}명`, '학생수']} />
            <Bar dataKey="n" fill="#2f6db0" isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <table className="tbl compact">
        <thead><tr><th>성취수준</th><th className="num">학생수</th><th className="num">비율</th><th className="num">평균</th><th className="num">표준편차</th></tr></thead>
        <tbody>
          {dist.map((d) => (
            <tr key={d.level}>
              <td><span className="lvl-dot" style={{ background: LEVEL_COLORS[d.level] }} />{d.level}</td>
              <td className="num">{d.n}</td><td className="num">{FORMAT.p(d.ratio)}</td>
              <td className="num">{FORMAT.score(d.meanRaw)}</td><td className="num">{FORMAT.score(d.sdRaw)}</td>
            </tr>
          ))}
        </tbody>
      </table>

    </div>
  );
}
