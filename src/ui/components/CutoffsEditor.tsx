import { useEffect, useState } from 'react';
import { useStore } from '../state/store';
import { config, type Cutoffs } from '@core/index';

const KEYS: { k: keyof Cutoffs; label: string }[] = [
  { k: 'AB', label: 'A / B' }, { k: 'BC', label: 'B / C' },
  { k: 'CD', label: 'C / D' }, { k: 'DE', label: 'D / E' },
];

type Draft = Record<keyof Cutoffs, string>;
const toDraft = (c: Cutoffs): Draft => ({ AB: String(c.AB), BC: String(c.BC), CD: String(c.CD), DE: String(c.DE) });
const fromDraft = (d: Draft): Cutoffs | null => {
  if (Object.values(d).some((v) => v.trim() === '')) return null;
  const parsed = {
    AB: Number(d.AB),
    BC: Number(d.BC),
    CD: Number(d.CD),
    DE: Number(d.DE),
  };
  const values = Object.values(parsed);
  if (values.some((v) => !Number.isFinite(v) || v < 0 || v > 100)) return null;
  if (!(parsed.AB > parsed.BC && parsed.BC > parsed.CD && parsed.CD > parsed.DE)) return null;
  return parsed;
};

export function CutoffsEditor() {
  const cutoffs = useStore((s) => s.cutoffs);
  const setCutoffs = useStore((s) => s.setCutoffs);
  const [draft, setDraft] = useState<Draft>(() => toDraft(cutoffs));
  const isDefault = KEYS.every(({ k }) => cutoffs[k] === config.DEFAULT_CUTOFFS[k]);
  const parsed = fromDraft(draft);
  const hasInvalid = parsed == null;

  useEffect(() => {
    setDraft(toDraft(cutoffs));
  }, [cutoffs]);

  const change = (k: keyof Cutoffs, value: string) => {
    const next = { ...draft, [k]: value };
    setDraft(next);
    const valid = fromDraft(next);
    if (valid) setCutoffs(valid);
  };

  const resetDefault = () => {
    setDraft(toDraft(config.DEFAULT_CUTOFFS));
    setCutoffs({ ...config.DEFAULT_CUTOFFS });
  };

  return (
    <div className={`cutoffs${hasInvalid ? ' invalid' : ''}`}>
      <div className="cutoffs-head">성취수준 분할점수 {!isDefault && <span className="badge badge-warn">수정됨</span>}</div>
      {KEYS.map(({ k, label }) => (
        <label key={k} className="cutoff-row">
          <span>{label}</span>
          <input type="number" min={0} max={100} value={draft[k]} aria-invalid={hasInvalid}
            onChange={(e) => change(k, e.target.value)} />
        </label>
      ))}
      {hasInvalid && <div className="cutoffs-error">0~100 사이에서 A/B &gt; B/C &gt; C/D &gt; D/E 순서로 입력하세요.</div>}
      {!isDefault && (
        <button className="btn-ghost sm" onClick={resetDefault}>기본값으로</button>
      )}
    </div>
  );
}
