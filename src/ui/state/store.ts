// ui/state/store.ts — UI↔core 얇은 어댑터(zustand). core 결과만 보관.
// 파일 파싱(xlsx/pdf)은 recognize 에서 완료 → 여기선 buildDatasetFrom 으로 조립·분석만.
import { create } from 'zustand';
import {
  analyze, buildDatasetFrom, config,
  type AnalysisResult, type Cutoffs, type Dataset, type ItemInfoTable, type ValidationIssue,
} from '@core/index';
import type { Recognition } from '../lib/recognize';

type Status = 'empty' | 'loading' | 'ready' | 'error';

interface AppState {
  status: Status;
  error?: string;

  info?: ItemInfoTable;
  dataset?: Dataset;
  result?: AnalysisResult;
  issues: ValidationIssue[];

  cutoffs: Cutoffs;
  selectedQ?: number;
  filters: string[];
  sort?: { key: string; dir: 'asc' | 'desc' };

  loadRecognized(recs: Recognition[], options?: { allowConflicts?: boolean }): void;
  setCutoffs(c: Cutoffs): void;
  selectQ(q?: number): void;
  toggleFilter(code: string): void;
  clearFilters(): void;
  setSort(key: string): void;
  reset(): void;
}

export const useStore = create<AppState>((set, get) => ({
  status: 'empty',
  issues: [],
  cutoffs: { ...config.DEFAULT_CUTOFFS },
  filters: [],

  loadRecognized(recs, options) {
    const infos = recs.filter((r) => r.role === 'info' && r.info);
    const marks = recs.filter((r) => r.role === 'marks' && r.sheet);
    if (!infos.length || !marks.length) {
      set({ status: 'error', error: '문항정보표 1개와 정오표 1개 이상이 필요합니다.' });
      return;
    }
    try {
      const { info, dataset, issues } = buildDatasetFrom(infos[0].info!, marks.map((m) => m.sheet!));
      if (issues.some((issue) => issue.severity === '차단') && !options?.allowConflicts) {
        set({ status: 'empty', issues, error: undefined, info: undefined, dataset: undefined, result: undefined });
        return;
      }
      const result = analyze(dataset, config.DEFAULT_CUTOFFS);
      set({ info, dataset, issues, result, status: 'ready', cutoffs: { ...config.DEFAULT_CUTOFFS }, selectedQ: undefined, filters: [], sort: undefined });
    } catch (e) {
      set({ status: 'error', error: e instanceof Error ? e.message : String(e) });
    }
  },

  setCutoffs(c) {
    const { dataset } = get();
    if (!dataset) return;
    set({ cutoffs: c, result: analyze(dataset, c) });
  },

  selectQ(q) { set({ selectedQ: q }); },
  toggleFilter(code) {
    const f = new Set(get().filters);
    if (f.has(code)) f.delete(code);
    else f.add(code);
    set({ filters: [...f] });
  },
  clearFilters() { set({ filters: [] }); },
  setSort(key) {
    const cur = get().sort;
    if (!cur || cur.key !== key) set({ sort: { key, dir: 'desc' } });
    else if (cur.dir === 'desc') set({ sort: { key, dir: 'asc' } });
    else set({ sort: undefined });
  },
  reset() {
    set({ status: 'empty', error: undefined, info: undefined, dataset: undefined, result: undefined, issues: [], selectedQ: undefined, filters: [], sort: undefined });
  },
}));
