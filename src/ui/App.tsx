import { useEffect, useRef, useState } from 'react';
import packageJson from '../../package.json';
import { useStore } from './state/store';
import { Landing } from './components/Landing';
import { Dashboard } from './components/Dashboard';

interface AvailableUpdate {
  version: string;
  pageUrl: string;
  downloadUrl: string;
}

export function App() {
  const status = useStore((s) => s.status);
  const error = useStore((s) => s.error);
  const reset = useStore((s) => s.reset);
  const [availableUpdate, setAvailableUpdate] = useState<AvailableUpdate | null>(null);
  const topbarRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const setTopbarHeight = () => {
      const h = topbarRef.current?.getBoundingClientRect().height;
      if (h) document.documentElement.style.setProperty('--topbar-h', `${Math.ceil(h)}px`);
    };
    setTopbarHeight();
    window.addEventListener('resize', setTopbarHeight);
    const ro = typeof ResizeObserver !== 'undefined' && topbarRef.current
      ? new ResizeObserver(setTopbarHeight)
      : null;
    if (ro && topbarRef.current) ro.observe(topbarRef.current);
    return () => {
      window.removeEventListener('resize', setTopbarHeight);
      ro?.disconnect();
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    let delayId: number | undefined;
    let idleId: number | undefined;

    const check = () => {
      void import('./lib/updateCheck')
        .then(({ checkForUpdate }) => checkForUpdate())
        .then((update) => { if (!cancelled && update) setAvailableUpdate(update); })
        .catch(() => undefined);
    };
    const deferUntilIdle = () => {
      // 초기 렌더·파일 파서와 네트워크/CPU를 경쟁하지 않도록 load 이후에도 한 번 더 늦춘다.
      delayId = window.setTimeout(() => {
        if ('requestIdleCallback' in window) idleId = window.requestIdleCallback(check, { timeout: 8000 });
        else check();
      }, 2500);
    };

    if (document.readyState === 'complete') deferUntilIdle();
    else window.addEventListener('load', deferUntilIdle, { once: true });
    return () => {
      cancelled = true;
      window.removeEventListener('load', deferUntilIdle);
      if (delayId != null) window.clearTimeout(delayId);
      if (idleId != null && 'cancelIdleCallback' in window) window.cancelIdleCallback(idleId);
    };
  }, []);

  return (
    <div className="app">
      <header className="topbar" ref={topbarRef}>
        <div className="topbar-title">
          <h1>지필평가 문항분석 <span className="ver">v{packageJson.version}</span></h1>
          {availableUpdate && (
            <a
              className="update-available"
              href={availableUpdate.downloadUrl}
              download="achievement-eval.html"
              rel="noreferrer noopener"
              title={`v${availableUpdate.version} 단일 HTML 다운로드`}
            >
              새 버전 v{availableUpdate.version} 다운로드
            </a>
          )}
        </div>
        <div className="topbar-right">
          {status === 'ready' && <button className="btn-ghost" onClick={reset}>새로 시작</button>}
        </div>
      </header>

      {status === 'empty' && <Landing />}
      {status === 'loading' && <div className="center muted">분석 중…</div>}
      {status === 'error' && (
        <div className="center">
          <p className="error">파일을 읽지 못했습니다: {error}</p>
          <button className="btn-ghost" onClick={reset}>처음으로</button>
        </div>
      )}
      {status === 'ready' && <Dashboard />}
    </div>
  );
}
