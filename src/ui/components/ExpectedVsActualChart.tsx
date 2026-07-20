import {
  ScatterChart, Scatter, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceArea, Cell, CartesianGrid,
} from 'recharts';
import { useStore } from '../state/store';
import { FORMAT } from '../lib/ui';
import { config, type Difficulty } from '@core/index';
import { Help } from './Help';

const RANK: Record<string, number> = { 쉬움: 1, 보통: 2, 어려움: 3 };
const LABELS: Record<number, string> = { 1: '쉬움', 2: '보통', 3: '어려움' };
const jitter = (qno: number) => ((qno % 7) - 3) * 0.05;

interface Pt { x: number; y: number; qno: number; diff: Difficulty; mismatch: boolean }

export function ExpectedVsActualChart() {
  const result = useStore((s) => s.result)!;
  const selectQ = useStore((s) => s.selectQ);
  const eva = result.expectedVsActual;

  const pts: Pt[] = result.items
    .filter((it) => it.difficulty !== '미상')
    .map((it) => ({
      x: RANK[it.difficulty] + jitter(it.qno),
      y: it.p,
      qno: it.qno,
      diff: it.difficulty,
      mismatch: it.flags.some((f) => f.code === 'DIFF_MISMATCH'),
    }));

  const R = config.EXPECTED_P_RANGE;
  const mismatchColor = config.SEVERITY['점검'].color;

  return (
    <div className="card">
      <h3>예상난이도 ↔ 실측 정답률 정합성 <Help>출제자 예상난이도(x)와 실제 정답률(y)의 일치도. 밴드(연녹색)가 각 난이도의 기대 정답률 구간. 밴드를 벗어난 문항이 예상과 다르게 나온 문항입니다. τ-b가 1에 가까울수록 예상이 정확.</Help></h3>
      <div className="caption">
        τ-b {eva.tauB != null ? eva.tauB.toFixed(2) : '—'}
        {' · '}불일치 {eva.mismatches.length}건
        {eva.mismatches.length > 0 && <> : {eva.mismatches.map((m) => (
          <button key={m.qno} className="link" onClick={() => selectQ(m.qno)}>Q{m.qno}</button>
        )).reduce((a, b) => <>{a} {b}</>)}</>}
      </div>
      <ResponsiveContainer width="100%" height={260}>
        <ScatterChart margin={{ top: 10, right: 16, bottom: 8, left: -8 }}>
          <CartesianGrid strokeDasharray="3 3" />
          {/* 각 난이도 기대 정답률 밴드 */}
          <ReferenceArea x1={0.5} x2={1.5} y1={R['쉬움'][0]} y2={R['쉬움'][1]} fill="#4D9221" fillOpacity={0.08} />
          <ReferenceArea x1={1.5} x2={2.5} y1={R['보통'][0]} y2={R['보통'][1]} fill="#4D9221" fillOpacity={0.08} />
          <ReferenceArea x1={2.5} x2={3.5} y1={R['어려움'][0]} y2={R['어려움'][1]} fill="#4D9221" fillOpacity={0.08} />
          <XAxis type="number" dataKey="x" domain={[0.5, 3.5]} ticks={[1, 2, 3]} tickFormatter={(v: number) => LABELS[v] ?? ''} />
          <YAxis type="number" dataKey="y" domain={[0, 1]} tickFormatter={(v: number) => `${Math.round(v * 100)}%`} />
          <Tooltip cursor={{ strokeDasharray: '3 3' }} content={({ active, payload }) => {
            if (!active || !payload?.length) return null;
            const p = payload[0].payload as Pt;
            return <div className="rc-tip">Q{p.qno} · 예상 {p.diff} · 정답률 {FORMAT.p(p.y)}{p.mismatch ? ' ⚠ 불일치' : ''}</div>;
          }} />
          <Scatter data={pts} isAnimationActive={false} onClick={(d) => d && selectQ((d as unknown as Pt).qno)}>
            {pts.map((p) => (
              <Cell key={p.qno} fill={p.mismatch ? mismatchColor : '#9aa0a6'} stroke={p.mismatch ? '#8a5a00' : '#6b7075'} />
            ))}
          </Scatter>
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  );
}
