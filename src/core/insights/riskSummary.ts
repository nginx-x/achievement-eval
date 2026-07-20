// core/insights/riskSummary.ts — "봐야 할 것" 자동 요약(§3.9, §13.3)
import type {
  AchievementSummary, ConstructedSummary, ExpectedVsActual, Flag, FlagLevel, ItemStat, Reliability, RiskSummary,
} from '../types';
import { ALPHA_BANDS, bandOf, FORMAT } from '../config';

const SEV_ORDER: FlagLevel[] = ['심각', '주의', '점검'];
const topSeverityOf = (flags: Flag[]): FlagLevel | null =>
  SEV_ORDER.find((lv) => flags.some((f) => f.level === lv)) ?? null;

export function computeRiskSummary(
  items: ItemStat[],
  achievement: AchievementSummary,
  reliability: Reliability,
  eva: ExpectedVsActual,
  constructed?: ConstructedSummary | null,
): RiskSummary {
  const counts: Record<FlagLevel, number> = { 심각: 0, 주의: 0, 점검: 0 };
  const flaggedItems: { qno: number; flags: Flag[] }[] = [];
  for (const it of items) {
    const sev = topSeverityOf(it.flags);
    if (sev) { counts[sev]++; flaggedItems.push({ qno: it.qno, flags: it.flags }); }
  }
  // 서답형 위험(예: 음의 변별도)도 카운트에 반영
  const consSev = constructed ? topSeverityOf(constructed.flags) : null;
  if (consSev) counts[consSev]++;
  flaggedItems.sort((a, b) => {
    const sa = SEV_ORDER.indexOf(topSeverityOf(a.flags)!);
    const sb = SEV_ORDER.indexOf(topSeverityOf(b.flags)!);
    return sa - sb || a.qno - b.qno;
  });

  // 한 줄 총평 (위험 0건이어도 의미 있는 요약)
  const nQ = items.length;
  const hardest = items.reduce((m, it) => (it.p < m.p ? it : m), items[0]);
  const alpha = reliability.alpha;
  const alphaLabel = Number.isNaN(alpha) ? '계산 불가' : bandOf(ALPHA_BANDS, alpha).label;
  const tau = eva.tauB;
  const parts = [
    `${nQ}문항 중 심각 ${counts.심각}·주의 ${counts.주의}·점검 ${counts.점검}`,
    `평균 ${FORMAT.score(achievement.overall.mean)}점(SD ${FORMAT.score(achievement.overall.sd)})`,
    hardest ? `최저 정답률 Q${hardest.qno}(${FORMAT.p(hardest.p)})` : '',
    Number.isNaN(alpha) ? '' : `신뢰도 α ${FORMAT.alpha(alpha)}(${alphaLabel})`,
    tau != null ? `예상난이도 정합성 τ-b ${tau.toFixed(2)}` : '',
    consSev ? `서답형 ${consSev}: ${constructed!.flags[0].message}` : '',
  ].filter(Boolean);

  return { counts, flaggedItems, narrative: parts.join(', ') + '.' };
}
