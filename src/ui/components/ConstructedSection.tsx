import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts';
import { useStore } from '../state/store';
import { FORMAT } from '../lib/ui';
import { config, LEVELS } from '@core/index';
import type { Band } from '@core/config';
import { Help } from './Help';

const TONE: Record<Band['tone'], string> = { good: '#2e7d32', warn: '#b26a00', bad: '#B2182B', neutral: '#605d52' };

function DiscChip({ value }: { value: number }) {
  const b = config.bandOf(config.DISC_BANDS, value);
  return (
    <span className="mchip">
      <span className="mchip-l">변별도</span>
      <span className="mchip-v" style={{ color: TONE[b.tone] }}>{FORMAT.disc(value)}</span>
      <span className="mchip-b">{b.label}</span>
    </span>
  );
}

/** 획득률(0..1) 셀 배경: 낮을수록 회색(라이브 앱 '50% 미만 음영' 계승, 여기선 그라데이션) */
function rateBg(v: number | null): string {
  if (v == null) return '#f5f5f5';
  return v < 0.5 ? `rgba(150,150,150,${0.15 + (0.5 - v) * 0.5})` : 'transparent';
}

function distBg(v: number): string {
  if (v <= 0) return 'transparent';
  return `rgba(47,109,176,${0.1 + v * 0.6})`;
}

export function ConstructedSection() {
  const c = useStore((s) => s.result)!.constructed;
  if (!c) return null;

  const chartData = c.scoreDist.map((d) => ({ label: `${d.score}`, n: d.n }));
  const scoreCols = c.scoreDist.map((d) => d.score);
  // 성취수준 × 부분점수 교차표 행(수준 + 전체)
  const xtab = [
    ...LEVELS.map((lv) => {
      const row = c.distByLevel.find((r) => r.level === lv)!;
      return { label: lv, n: row.n, dist: row.dist };
    }),
    { label: '전체', n: c.n, dist: Object.fromEntries(c.scoreDist.map((d) => [String(d.score), d.ratio])) },
  ];

  return (
    <div className="card">
      <h3>서답형 분석 <span className="muted sm">(서답형점수 합계를 부분점수 문항으로 분석)</span>
        <Help>NEIS 정오표에는 서답형 문항별 점수가 없어 '서답형점수' 합계를 단일 부분점수(폴리토머스) 문항으로 분석합니다. 정답률 대신 <b>평균 획득률(평균÷만점)</b>을 사용하며, 변별도는 KICE와 같은 비교정 상관입니다.</Help>
      </h3>

      <div className="stat-row">
        <div className="stat"><span className="stat-v">{c.maxPoints}점</span><span className="stat-l">만점</span></div>
        <div className="stat"><span className="stat-v">{FORMAT.score(c.mean)}</span><span className="stat-l">평균</span></div>
        <div className="stat"><span className="stat-v">{FORMAT.score(c.sd)}</span><span className="stat-l">표준편차</span></div>
        <div className="stat"><span className="stat-v">{c.min}~{c.max}</span><span className="stat-l">최저~최고</span></div>
        <div className="stat"><span className="stat-v">{FORMAT.p(c.rate)}</span><span className="stat-l">평균 획득률</span></div>
      </div>

      <div className="metric-chips">
        <DiscChip value={c.discrimination} />
      </div>

      {c.flags.length > 0 && (
        <ul className="flags">
          {c.flags.map((f, i) => (
            <li key={i} className="flag">
              <span style={{ color: config.SEVERITY[f.level].color }}>{config.SEVERITY[f.level].shape} <b>{f.level}</b></span> {f.message}
            </li>
          ))}
        </ul>
      )}

      <div className="chart-grid">
        <div className="chart-box">
          <div className="chart-title">성취수준별 평균 획득률</div>
          <div className="tbl-scroll">
            <table className="tbl compact">
              <thead><tr><th>수준</th><th className="num">n</th><th className="num">평균</th><th className="num">획득률</th></tr></thead>
              <tbody>
                {c.byLevel.map((b) => (
                  <tr key={b.level}>
                    <td><span className="lvl-dot" style={{ background: config.LEVEL_COLORS[b.level] }} />{b.level}</td>
                    <td className="num">{b.n}</td>
                    <td className="num">{b.n ? FORMAT.score(b.mean) : '—'}</td>
                    <td className="num" style={{ background: rateBg(b.rate) }}>{b.rate != null ? FORMAT.p(b.rate) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="chart-box">
          <div className="chart-title">부분점수 분포 <span className="muted sm">(점수별 인원)</span></div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={chartData} margin={{ top: 8, right: 8, bottom: 4, left: 4 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="label" fontSize={11} />
              <YAxis allowDecimals={false} />
              <Tooltip formatter={(v: number) => [`${v}명`, '학생수']} labelFormatter={(l) => `${l}점`} />
              <Bar dataKey="n" fill="#2f6db0" isAnimationActive={false} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {c.items.length > 0 && (
        <>
          <h4 className="sub">서답형 문항 구성 <span className="muted sm">(문항정보표 기준 · 문항별 점수는 정오표에 없어 합계로만 분석)</span></h4>
          <table className="tbl compact">
            <thead><tr><th>번호</th><th>내용영역</th><th>성취기준</th><th>예상난이도</th><th className="num">배점</th></tr></thead>
            <tbody>
              {c.items.map((it) => (
                <tr key={it.qno}>
                  <td>서답형 {it.qno}</td>
                  <td>{it.area}</td>
                  <td className="std-cell">{it.standard}</td>
                  <td>{it.difficulty}</td>
                  <td className="num">{it.points}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      <h4 className="sub">성취수준 × 부분점수 분포 <span className="muted sm">(행 내 % · 쏠림=진함)</span></h4>
      <div className="tbl-scroll">
        <table className="tbl xtab compact">
          <thead>
            <tr>
              <th>수준</th>
              {scoreCols.map((s) => <th key={s} className="num">{s}점</th>)}
            </tr>
          </thead>
          <tbody>
            {xtab.map((r) => (
              <tr key={r.label} className={r.label === '전체' ? 'total-row' : ''}>
                <td>{r.label} <span className="muted sm">n{r.n}</span></td>
                {scoreCols.map((s) => {
                  const v = r.dist[String(s)] ?? 0;
                  return <td key={s} className="num" style={{ background: distBg(v) }}>{v > 0 ? Math.round(v * 100) : '·'}</td>;
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
