import { useEffect, useMemo, useState } from 'react';
import { useStore } from '../state/store';
import { RiskCard } from './RiskCard';
import { AchievementSection } from './AchievementSection';
import { ExpectedVsActualChart } from './ExpectedVsActualChart';
import { ItemMap } from './ItemMap';
import { ItemTable } from './ItemTable';
import { ItemDetail } from './ItemDetail';
import { ConstructedSection } from './ConstructedSection';
import { StandardsTable } from './StandardsTable';
import { LevelBoundary } from './LevelBoundary';
import { RawData } from './RawData';
import { CutoffsEditor } from './CutoffsEditor';

export function Dashboard() {
  const result = useStore((s) => s.result)!;
  const issues = useStore((s) => s.issues);
  const m = result.meta;
  const hasCons = result.constructed != null;
  const blocking = issues.filter((i) => i.severity === '차단');
  const warns = issues.filter((i) => i.severity === '경고');
  const navItems = useMemo(() => [
    { id: 'summary', label: '요약' },
    { id: 'achievement', label: '성취도' },
    { id: 'consistency', label: '예상난이도 정합성' },
    { id: 'itemmap', label: '문항 지도' },
    { id: 'items', label: '문항 분석' },
    ...(hasCons ? [{ id: 'constructed', label: '서답형' }] : []),
    { id: 'standards', label: '성취기준' },
    { id: 'boundary', label: '성취수준 경계' },
    { id: 'rawdata', label: '학생 원자료' },
  ], [hasCons]);
  const [activeSection, setActiveSection] = useState(navItems[0].id);

  useEffect(() => {
    const updateActive = () => {
      const styles = getComputedStyle(document.documentElement);
      const topEdge = Number.parseFloat(styles.scrollPaddingTop) || 72;
      const visible = navItems
        .map((item) => {
          const el = document.getElementById(item.id);
          return el ? { id: item.id, top: el.getBoundingClientRect().top } : null;
        })
        .filter((item): item is { id: string; top: number } => item != null);
      const current = [...visible].reverse().find((item) => item.top <= topEdge + 4) ?? visible[0];
      if (current) setActiveSection(current.id);
    };
    updateActive();
    window.addEventListener('scroll', updateActive, { passive: true });
    window.addEventListener('resize', updateActive);
    window.addEventListener('hashchange', updateActive);
    return () => {
      window.removeEventListener('scroll', updateActive);
      window.removeEventListener('resize', updateActive);
      window.removeEventListener('hashchange', updateActive);
    };
  }, [navItems]);

  return (
    <div className="dashboard">
      <aside className="sidebar">
        <div className="meta-block">
          <div className="meta-title">{[m.grade && `${m.grade}학년`, m.semester && `${m.semester}학기`, m.subject, m.examName].filter(Boolean).join(' ')}</div>
          <div className="coverage">{result.classes.length}개 반 · {result.nStudents}명 · {result.nQuestions}문항</div>
        </div>
        <CutoffsEditor />
        <nav className="secnav">
          {navItems.map((item) => (
            <a key={item.id} href={`#${item.id}`} className={activeSection === item.id ? 'active' : undefined}
              aria-current={activeSection === item.id ? 'location' : undefined}>
              {item.label}
            </a>
          ))}
        </nav>
      </aside>

      <main className="content">
        {blocking.length > 0 && (
          <div className="banner banner-block">⛔ 검증 차단 {blocking.length}건: {blocking.map((i) => i.message).join(' · ')} — 결과가 부정확할 수 있습니다.</div>
        )}
        {warns.length > 0 && (
          <div className="banner banner-warn">⚠ 경고 {warns.length}건: {warns.slice(0, 3).map((i) => i.message).join(' · ')}{warns.length > 3 ? ' …' : ''}</div>
        )}

        <section id="summary"><RiskCard /></section>
        <section id="achievement"><AchievementSection /></section>
        <section id="consistency"><ExpectedVsActualChart /></section>
        <section id="itemmap"><ItemMap /></section>
        <section id="items">
          <div className="card">
            <h3>문항 분석</h3>
            <ItemTable />
          </div>
        </section>
        {hasCons && <section id="constructed"><ConstructedSection /></section>}
        <section id="standards"><StandardsTable /></section>
        <section id="boundary"><LevelBoundary /></section>
        <section id="rawdata"><RawData /></section>
      </main>

      <ItemDetail />
    </div>
  );
}
