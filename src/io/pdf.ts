// io/pdf.ts — 브라우저 PDF 텍스트 위치 추출(pdf.js). core 는 이 결과(PdfWord[])만 파싱.
// 워커를 인라인(?worker&inline)으로 번들 → 단일파일(build:single, file://)에서도 동작.
// 공유 workerPort 사용 → recognize 는 순차 처리(concurrency 회피).
import * as pdfjsLib from 'pdfjs-dist';
import PdfjsWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?worker&inline';
import type { PdfWord } from '@core/index';

pdfjsLib.GlobalWorkerOptions.workerPort = new PdfjsWorker();

/** PDF → 위치기반 토큰(상단기준 y). 파서(core)가 컬럼/행을 재구성. */
export async function extractPdfWords(data: ArrayBuffer): Promise<PdfWord[]> {
  const doc = await pdfjsLib.getDocument({ data }).promise;
  const words: PdfWord[] = [];
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const vp = page.getViewport({ scale: 1 });
    const tc = await page.getTextContent();
    for (const it of tc.items) {
      if (!('str' in it) || !it.str.trim()) continue;
      const tr = it.transform;
      const x = tr[4];
      const yTop = vp.height - tr[5]; // 하단원점 → 상단기준
      const h = it.height || 10;
      const w = it.width || 0;
      words.push({ str: it.str, x, y: yTop, x1: x + w, y1: yTop + h, page: p });
    }
  }
  return words;
}
