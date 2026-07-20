// core/stats/standards.ts — 성취기준/내용영역 롤업(§3.8)
import type { ItemInfo, ItemStat, LevelRate, StandardRollup } from '../types';
import { LEVELS } from '../types';
import { mean } from './util';

export function computeStandards(itemInfo: ItemInfo[], items: ItemStat[]): StandardRollup[] {
  const statByQ = new Map(items.map((it) => [it.qno, it]));
  const groups = new Map<string, ItemInfo[]>();
  for (const it of itemInfo) {
    const key = it.standard || '(미지정)';
    (groups.get(key) ?? groups.set(key, []).get(key)!).push(it);
  }

  const rollups: StandardRollup[] = [];
  for (const [standard, infos] of groups) {
    const stats = infos.map((it) => statByQ.get(it.qno)).filter((s): s is ItemStat => !!s);
    if (stats.length === 0) continue;
    const totalPoints = stats.reduce((a, s) => a + s.points, 0);
    // 배점가중 수준별 성취율: Σ(수준별 정답률 × 배점) / Σ배점
    const achievementByLevel: LevelRate[] = LEVELS.map((lv) => {
      let num = 0, denom = 0, nMax = 0;
      for (const s of stats) {
        const r = s.pByLevel.find((x) => x.level === lv);
        if (r && r.p != null) { num += r.p * s.points; denom += s.points; nMax = Math.max(nMax, r.n); }
      }
      return { level: lv, n: nMax, p: denom ? num / denom : null };
    });
    rollups.push({
      standard,
      area: infos[0].area,
      nItems: stats.length,
      totalPoints,
      meanP: mean(stats.map((s) => s.p)),
      meanDiscrimination: mean(stats.map((s) => s.discrimination)),
      achievementRate: totalPoints ? stats.reduce((a, s) => a + s.p * s.points, 0) / totalPoints : 0,
      achievementByLevel,
    });
  }
  // 취약(성취율 낮은) 순 정렬
  return rollups.sort((a, b) => a.achievementRate - b.achievementRate);
}
