import { useState, useCallback, type DragEvent } from 'react';
import { useStore } from '../state/store';
import { recognizeFile, type Recognition } from '../lib/recognize';

const ROLE_LABEL: Record<Recognition['role'], string> = { info: '문항정보표', marks: '정오표', unknown: '인식 불가' };

export function Landing() {
  const loadRecognized = useStore((s) => s.loadRecognized);
  const [recs, setRecs] = useState<Recognition[]>([]);
  const [busy, setBusy] = useState(false);
  const [over, setOver] = useState(false);

  const add = useCallback(async (list: FileList | null) => {
    if (!list) return;
    const files = [...list].filter((f) => /\.(xlsx|pdf)$/i.test(f.name));
    if (!files.length) return;
    setBusy(true);
    const results: Recognition[] = [];
    for (const f of files) results.push(await recognizeFile(f)); // 순차(공유 pdf 워커 안전)
    setRecs((prev) => [...prev, ...results]);
    setBusy(false);
  }, []);

  const remove = (i: number) => setRecs((prev) => prev.filter((_, x) => x !== i));
  const infos = recs.filter((r) => r.role === 'info');
  const marks = recs.filter((r) => r.role === 'marks');
  const canGo = infos.length >= 1 && marks.length >= 1;
  const go = () => { if (canGo) loadRecognized(recs); };

  const onDrop = (e: DragEvent) => { e.preventDefault(); setOver(false); void add(e.dataTransfer.files); };

  return (
    <div className="landing">
      <section className="hero">
        <h2>파일을 올리면 <em>검토할 문항</em>을 짚어 드립니다.</h2>
        <p className="lead">모든 처리가 <b>이 브라우저 안에서만</b> 이뤄지므로, 어떤 데이터도 외부로 전송/저장되지 않습니다.</p>
      </section>

      <section className="uploader card">
        <label className={`dropzone${over ? ' over' : ''}`}
          onDragOver={(e) => { e.preventDefault(); setOver(true); }}
          onDragLeave={() => setOver(false)} onDrop={onDrop}>
          <input type="file" accept=".xlsx,.pdf" multiple hidden onChange={(e) => void add(e.target.files)} />
          <div className="dz-icon">＋</div>
          <div className="dz-title">문항정보표와 반별 학생답정오표(.xls 또는 PDF)를 여기에 놓으세요.</div>
          <div className="dz-hint">여러 파일을 한 번에 전부 올리세요. 엑셀/PDF 섞어도 자동 인식합니다.{busy ? ' · 인식 중…' : ''}</div>
        </label>

        <details className="neis-guide" open>
          <summary>NEIS에서 필요한 파일 받는 방법</summary>
          <div className="neis-body">
            <div className="neis-file">
              <span className="file-badge badge-info">문항정보표</span>
              <div className="neis-path">NEIS › 교과담임 › 정기시험 › <b>문항정보표관리</b></div>
              <ol>
                <li>학년도·학기·고사·학년·과목을 선택하고 <b>조회</b></li>
                <li><b>출력</b> → <b>미리보기</b></li>
                <li><b>저장</b>으로 PDF 또는 <b>XLS data</b> 내려받기</li>
              </ol>
            </div>
            <div className="neis-file">
              <span className="file-badge badge-marks">학생답 정오표</span>
              <div className="neis-path">NEIS › 교과담임 › 정기시험조회/통계 › <b>정기시험조회</b></div>
              <ol>
                <li><b>교과목별학생답정오표</b> 클릭</li>
                <li>학년도·학기·고사·학년·과목·강의실 선택, <b>한페이지출력</b> 체크 후 <b>조회</b></li>
                <li><b>저장</b>으로 PDF 또는 <b>XLS data</b> 내려받기</li>
                <li>반(강의실)을 바꿔 가며 <b>모든 반을 반복</b>해 저장</li>
              </ol>
            </div>
            <p className="neis-tip">받은 파일을 <b>한꺼번에</b> 위 칸에 올리면 종류와 반을 알아서 인식합니다.</p>
          </div>
        </details>

        {recs.length > 0 && (
          <ul className="file-list">
            {recs.map((r, i) => (
              <li key={i} className={`file-item role-${r.role}`}>
                <span className={`file-badge badge-${r.role}`}>{ROLE_LABEL[r.role]}</span>
                <span className="file-name">{r.file.name}</span>
                <span className="file-label muted">{r.label}</span>
                <button className="icon-btn" aria-label="제거" onClick={() => remove(i)}>✕</button>
              </li>
            ))}
          </ul>
        )}

        <div className="upload-foot">
          <div className="reqs">
            <span className={infos.length ? 'ok' : 'need'}>{infos.length ? '✓' : '○'} 문항정보표{infos.length ? ` (${infos.length})` : ''}</span>
            <span className={marks.length ? 'ok' : 'need'}>{marks.length ? '✓' : '○'} 학생답정오표 {marks.length}개</span>
            {infos.length > 1 && <span className="warn-inline">문항정보표가 여러 개 첨부되어, 첫 번째만 사용합니다.</span>}
          </div>
          <button className="btn-primary" disabled={!canGo} onClick={go}>분석 보기 →</button>
        </div>
      </section>

      <footer className="colophon">
        <div className="colophon-head">이 도구에 대하여</div>
        <p>
          한국교육과정평가원의 성취평가 지원 웹앱
          (<a href="https://kice-se.shinyapps.io/webapp_mid/" target="_blank" rel="noreferrer noopener">kice-se.shinyapps.io/webapp_mid</a>)
          에서 아이디어를 얻어 구체화했습니다. 원본의 수행평가 분석 기능은 의도적으로 제외하고,
          정기시험 분석에 집중했습니다. 덕산중학교 김원예 선생님의 연수에서 얻은 아이디어도 함께 담았습니다. 깊은 감사의 말씀을 드립니다. 또한 각종 예시 데이터를 통해 웹앱을 개선하는 데 도움을 주신 선생님들께도 감사드립니다. 한 문항에 여러 성취기준이 있는 경우 등은 충분히 검증하지 못했으므로,
          어떤 문제라도 발생한다면 데이터 파일과 함께 알려주시면 고치겠습니다.
          1.1 업데이트를 통해 변별도를 KICE 웹앱과 같은 방식으로 통일했습니다. 또한 각종 버그를 고치고, 복수답안 및 업데이트 확인 기능도 지원합니다. — 숭인중 김근홍 드림
        </p>
      </footer>
    </div>
  );
}
