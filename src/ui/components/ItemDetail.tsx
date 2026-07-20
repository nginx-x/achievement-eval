import { useEffect, useState } from 'react';
import { Dialog, DialogBackdrop, DialogPanel, DialogTitle } from '@headlessui/react';
import { useStore } from '../state/store';
import { FORMAT, responseCellBackground, severityOf } from '../lib/ui';
import { config, formatAnswerCode, type LevelOptionDist } from '@core/index';
import type { Band } from '@core/config';
import { MultiAnswerResponse } from './MultiAnswerResponse';

const TONE: Record<Band['tone'], string> = { good: '#2e7d32', warn: '#b26a00', bad: '#B2182B', neutral: '#605d52' };
const MISC_RESPONSE = '무응답·기타';
const OPTS = ['1', '2', '3', '4', '5', MISC_RESPONSE];
const optLabel = (o: string) => (o === MISC_RESPONSE ? '무응/기타' : o);
const distValue = (dist: Record<string, number>, opt: string) =>
  opt === MISC_RESPONSE ? (dist[config.NO_RESPONSE] ?? 0) + (dist[config.OTHER_RESPONSE] ?? 0) : (dist[opt] ?? 0);

function Metric({ label, text, bands, value }: { label: string; text: string; bands: Band[]; value: number }) {
  const b = config.bandOf(bands, value);
  return (
    <span className="mchip">
      <span className="mchip-l">{label}</span>
      <span className="mchip-v" style={{ color: TONE[b.tone] }}>{text}</span>
      <span className="mchip-b">{b.label}</span>
    </span>
  );
}

/** 성취수준 집합의 보기별 분포 가중 합산 */
function aggDist(rows: LevelOptionDist[], set: string[]): { dist: Record<string, number>; n: number } {
  const acc: Record<string, number> = {};
  let n = 0;
  for (const r of rows) {
    if (!set.includes(r.level)) continue;
    for (const [k, v] of Object.entries(r.dist)) acc[k] = (acc[k] ?? 0) + v * r.n;
    n += r.n;
  }
  for (const k of Object.keys(acc)) acc[k] = n ? acc[k] / n : 0;
  return { dist: acc, n };
}

export function ItemDetail() {
  const result = useStore((s) => s.result)!;
  const info = useStore((s) => s.info)!;
  const selectedQ = useStore((s) => s.selectedQ);
  const selectQ = useStore((s) => s.selectQ);

  const items = result.items;
  const open = selectedQ != null;
  const [shownQ, setShownQ] = useState<number | undefined>(selectedQ);
  useEffect(() => { if (selectedQ != null) setShownQ(selectedQ); }, [selectedQ]);

  const idx = items.findIndex((i) => i.qno === shownQ);
  const it = items[idx];
  const meta = info.items.find((m) => m.qno === shownQ);

  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft' && idx > 0) selectQ(items[idx - 1].qno);
      else if (e.key === 'ArrowRight' && idx < items.length - 1) selectQ(items[idx + 1].qno);
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [open, idx, items, selectQ]);

  const sev = it ? severityOf(it.flags) : null;
  const ans = it?.answer ?? '';

  // 오답 진단 (C2): 상위(A+B) vs 하위(D+E) 최다오답
  let misconception: { text: string; kind: 'attract' | 'gap' } | null = null;
  if (it && !it.multiAnswer) {
    const upper = aggDist(it.distractorByLevel, ['A', 'B']);
    const lower = aggDist(it.distractorByLevel, ['D', 'E']);
    const topWrong = (d: Record<string, number>) =>
      Object.entries(d).filter(([k]) => k !== ans && k !== config.NO_RESPONSE && k !== config.OTHER_RESPONSE).sort((a, b) => b[1] - a[1])[0] ?? ['—', 0] as [string, number];
    const [uOpt, uRate] = topWrong(upper.dist);
    const [lOpt, lRate] = topWrong(lower.dist);
    if (upper.n >= 5 && (uRate as number) >= 0.2) {
      // 상위권도 특정 오답에 쏠림 = 정답과 혼동될 만큼 잘 만든(매력적인) 오답
      misconception = { kind: 'attract', text: `상위권(A·B)도 보기 ${uOpt}를 ${FORMAT.p(uRate as number)} 선택 — 정답과 혼동될 만큼 매력적인 오답이 구성되었습니다.` };
    } else if (lower.n >= 5 && (lRate as number) >= 0.25) {
      misconception = { kind: 'gap', text: `하위권(D·E)이 보기 ${lOpt}에 ${FORMAT.p(lRate as number)} 쏠림 — 해당 보기 관련 오개념 보충이 필요합니다.` };
    }
  }

  // 수준×보기 교차표 행 (A2)
  const xtabRows = it
    ? [
        ...it.pByLevel.map((r) => ({
          label: r.level, n: r.n, p: r.p,
          dist: it.distractorByLevel.find((d) => d.level === r.level)?.dist ?? {},
        })),
        { label: '전체', n: result.nStudents, p: it.p, dist: it.distractor },
      ]
    : [];

  return (
    <Dialog open={open} onClose={() => selectQ(undefined)} className="drawer-dialog">
      <DialogBackdrop transition className="drawer-backdrop" />
      <div className="drawer-wrap">
        <DialogPanel transition className="drawer">
          {it && (
            <>
              <div className="drawer-head">
                <div className="nav-btns">
                  <button className="btn-ghost sm" disabled={idx <= 0} onClick={() => selectQ(items[idx - 1].qno)}>← 이전</button>
                  <button className="btn-ghost sm" disabled={idx >= items.length - 1} onClick={() => selectQ(items[idx + 1].qno)}>다음 →</button>
                  <span className="muted sm">←/→ 키</span>
                </div>
                <button className="icon-btn" aria-label="닫기" onClick={() => selectQ(undefined)}>✕</button>
              </div>

              <DialogTitle className="drawer-title">
                Q{it.qno}
                {it.multiAnswer && <span className="multi-pill">복수정답</span>}
                {sev && it.flags.length > 0 && <span className="sev-shape" style={{ color: sev.color }}> {sev.shape}</span>}
                <span className="muted sm"> 정답 {formatAnswerCode(it.answer)} · 배점 {it.points} · 예상 {it.difficulty}</span>
              </DialogTitle>
              {meta && <p className="std-cell">{meta.area}<br /><span className="muted sm">{meta.standard}</span></p>}

              <div className="metric-chips">
                <Metric label="정답률" text={FORMAT.p(it.p)} bands={config.P_BANDS} value={it.p} />
                <Metric label="변별도(KICE 방식)" text={FORMAT.disc(it.discrimination)} bands={config.DISC_BANDS} value={it.discrimination} />
              </div>

              {(it.decidesBoundary || it.representsLevels.length > 0) && (
                <div className="lvl-badges">
                  {it.decidesBoundary && <span className="lb-badge decide">{it.decidesBoundary.boundary} 경계 결정 −{Math.round(it.decidesBoundary.gap * 100)}%p</span>}
                  {it.representsLevels.map((lv) => <span key={lv} className="lb-badge rep">{lv} 수준 대표문항</span>)}
                </div>
              )}

              {it.flags.length > 0 && (
                <ul className="flags">
                  {it.flags.map((f, i) => (
                    <li key={i} className="flag">
                      <span style={{ color: config.SEVERITY[f.level].color }}>{config.SEVERITY[f.level].shape} <b>{f.level}</b></span> {f.message}
                    </li>
                  ))}
                </ul>
              )}

              {misconception && (
                <div className={`misc misc-${misconception.kind}`}>
                  <b>{misconception.kind === 'attract' ? '🧲 매력적 오답' : '💡 오개념 진단'}</b> {misconception.text}
                </div>
              )}

              {it.multiAnswer ? (
                <MultiAnswerResponse item={it} nStudents={result.nStudents} />
              ) : (
                <>
                  <h4 className="sub">성취수준 × 보기별 답지반응 <span className="muted sm">(정답 열 강조 · 오답 쏠림=붉음)</span></h4>
                  <div className="tbl-scroll">
                    <table className="tbl xtab compact">
                      <thead>
                        <tr>
                          <th>수준</th><th className="num">정답률</th>
                          {OPTS.map((o) => <th key={o} className={`num${o === ans ? ' corr' : ''}`}>{optLabel(o)}</th>)}
                        </tr>
                      </thead>
                      <tbody>
                        {xtabRows.map((r) => (
                          <tr key={r.label} className={r.label === '전체' ? 'total-row' : ''}>
                            <td>{r.label} <span className="muted sm">n{r.n}</span></td>
                            <td className="num">{r.p != null ? FORMAT.p(r.p) : '—'}</td>
                            {OPTS.map((o) => {
                              const v = distValue(r.dist, o); const corr = o === ans;
                              return <td key={o} className="num" style={{ background: responseCellBackground(v, corr) }}>{v > 0 ? Math.round(v * 100) : '·'}</td>;
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </>
          )}
        </DialogPanel>
      </div>
    </Dialog>
  );
}
