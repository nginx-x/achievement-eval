import {
  ScatterChart, Scatter, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine, Cell, CartesianGrid,
} from 'recharts';
import { useStore } from '../state/store';
import { FORMAT, severityOf } from '../lib/ui';
import { Help } from './Help';

interface Pt { x: number; y: number; qno: number; color: string }

export function ItemMap() {
  const result = useStore((s) => s.result)!;
  const selectQ = useStore((s) => s.selectQ);
  const pts: Pt[] = result.items.map((it) => ({
    x: it.p, y: it.discrimination, qno: it.qno, color: severityOf(it.flags).color,
  }));

  return (
    <div className="card">
      <h3>문항 지도 <span className="muted sm">(정답률 × 변별도)</span> <Help>x=정답률, y=KICE 방식의 비교정 변별도. 변별도 0.2 미만(빨간 가로선 아래) 또는 정답률이 매우 높거나 낮으면서 변별이 낮은 문항이 점검 후보입니다.</Help></h3>
      <ResponsiveContainer width="100%" height={280}>
        <ScatterChart margin={{ top: 10, right: 20, bottom: 20, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis type="number" dataKey="x" domain={[0, 1]} tickFormatter={(v: number) => `${Math.round(v * 100)}%`}
            label={{ value: '정답률', position: 'insideBottom', offset: -8, fontSize: 12 }} />
          <YAxis type="number" dataKey="y" domain={[Math.min(0, ...pts.map((p) => p.y)) - 0.05, 'auto']}
            label={{ value: '변별도', angle: -90, position: 'insideLeft', fontSize: 12 }} />
          <ReferenceLine y={0.2} stroke="#B2182B" strokeDasharray="4 4" />
          <ReferenceLine y={0} stroke="#999" />
          <Tooltip cursor={{ strokeDasharray: '3 3' }} content={({ active, payload }) => {
            if (!active || !payload?.length) return null;
            const p = payload[0].payload as Pt;
            return <div className="rc-tip">Q{p.qno} · 정답률 {FORMAT.p(p.x)} · 변별도 {FORMAT.disc(p.y)}</div>;
          }} />
          <Scatter data={pts} isAnimationActive={false} onClick={(d) => d && selectQ((d as unknown as Pt).qno)}>
            {pts.map((p) => <Cell key={p.qno} fill={p.color} />)}
          </Scatter>
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  );
}
