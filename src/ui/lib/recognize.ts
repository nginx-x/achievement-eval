// ui/lib/recognize.ts — 업로드 파일 자동 인식(xlsx·pdf 공용). 인식 시 완전 파싱해 결과를 함께 반환.
import {
  sheetRows, cell, parseItemInfo, parseMarksheet, parseItemInfoPdf, parseMarksheetPdf,
  type ItemInfoTable, type Marksheet,
} from '@core/index';
import { extractPdfWords } from '@io/pdf';

export type FileRole = 'info' | 'marks' | 'unknown';
export interface Recognition {
  file: File;
  role: FileRole;
  label: string;
  classes?: string[];
  error?: string;
  info?: ItemInfoTable; // role==='info'
  sheet?: Marksheet; // role==='marks'
}

function marksInfo(m: Marksheet) {
  const classes = [...new Set(m.students.map((s) => s.classId))].sort((a, b) => Number(a) - Number(b));
  const g = m.meta.grade ? `${m.meta.grade}학년 ` : '';
  return { classes, label: `정오표 · ${g}${classes.map((c) => `${c}반`).join('·')} · ${m.students.length}명 · ${m.nQuestions}문항` };
}
const infoLabel = (t: ItemInfoTable) => `문항정보표 · ${t.subject ? t.subject + ' ' : ''}${t.items.length}문항`;

export async function recognizeFile(file: File): Promise<Recognition> {
  try {
    const buf = await file.arrayBuffer();

    if (file.name.toLowerCase().endsWith('.pdf')) {
      const words = await extractPdfWords(buf);
      const text = words.map((w) => w.str).join('').replace(/\s/g, '');
      if (/정오표/.test(text)) {
        const sheet = parseMarksheetPdf(words, file.name);
        const { label, classes } = marksInfo(sheet);
        return { file, role: 'marks', label, classes, sheet };
      }
      if (/문항정보표/.test(text)) {
        const info = parseItemInfoPdf(words);
        return { file, role: 'info', label: infoLabel(info), info };
      }
      return { file, role: 'unknown', label: 'PDF 인식 불가 — 문항정보표/정오표 PDF가 맞는지 확인하세요' };
    }

    // xlsx
    const rows = sheetRows(new Uint8Array(buf));
    if (rows.some((r) => cell(r, 2) === '번호')) {
      const sheet = parseMarksheet(rows, file.name);
      const { label, classes } = marksInfo(sheet);
      return { file, role: 'marks', label, classes, sheet };
    }
    const info = parseItemInfo(rows);
    if (info.items.length > 0) return { file, role: 'info', label: infoLabel(info), info };

    return { file, role: 'unknown', label: '인식 불가 — 문항정보표 또는 정오표 파일이 맞는지 확인하세요' };
  } catch (e) {
    return { file, role: 'unknown', label: '파일을 읽지 못했습니다', error: e instanceof Error ? e.message : String(e) };
  }
}
