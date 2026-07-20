// core/parse/pdfTypes.ts — PDF 위치기반 토큰(추출은 io 계층, 파싱은 core 순수함수)
export interface PdfWord {
  str: string;
  x: number; // 좌측 x (PDF points)
  y: number; // 상단 기준 y (아래로 증가)
  x1: number; // 우측 x
  y1: number; // 하단 y
  page: number; // 1-based
}

export const cxw = (w: PdfWord) => (w.x + w.x1) / 2;
export const cyw = (w: PdfWord) => w.y;
