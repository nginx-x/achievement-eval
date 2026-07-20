// core/parse/merge.ts — 반별 정오표 N개 병합 + 실시간 검증(§2.3)
import type { AnswerCode, ItemInfoTable, Marksheet, RawStudent, ValidationIssue } from '../types';
import { CORRECT_MARK } from '../config';

export interface MergedRaw {
  students: RawStudent[];
  answerKey: AnswerCode[];
  points: number[];
  nQuestions: number;
  scoreMax: Marksheet['scoreMax'];
  classes: string[];
  meta: Marksheet['meta'];
  issues: ValidationIssue[];
}

export function mergeMarksheets(sheets: Marksheet[], info?: ItemInfoTable): MergedRaw {
  const issues: ValidationIssue[] = [];
  if (sheets.length === 0) {
    return { students: [], answerKey: [], points: [], nQuestions: 0, scoreMax: null, classes: [], meta: {}, issues };
  }
  const base = sheets[0];
  const n = base.nQuestions;

  // 문항 수 일치
  for (const s of sheets) {
    if (s.nQuestions !== n) {
      issues.push({ severity: '차단', code: 'NQ_MISMATCH', file: s.sourceName, message: `문항 수 불일치(${s.nQuestions} vs ${n})` });
    }
  }
  if (info && info.items.length !== n) {
    issues.push({ severity: '차단', code: 'NQ_INFO_MISMATCH', message: `정오표 문항 수(${n})와 문항정보표(${info.items.length}) 불일치` });
  }

  // 정답키·배점 반간 일치
  for (const s of sheets.slice(1)) {
    if (s.nQuestions !== n) continue;
    for (let i = 0; i < n; i++) {
      if (s.answerKey[i] !== base.answerKey[i]) {
        issues.push({ severity: '차단', code: 'KEY_MISMATCH', file: s.sourceName, message: `학생답정오표 정답 상이(Q${i + 1}: ${base.answerKey[i] ?? '누락'} vs ${s.answerKey[i] ?? '누락'})` });
      }
      if (s.points[i] !== base.points[i]) {
        issues.push({ severity: '차단', code: 'POINT_MISMATCH', file: s.sourceName, message: `배점 상이(Q${i + 1}) — 결과 신뢰 불가` });
      }
    }
    // 파트별 만점(선택형·서답형·기타)도 반간 일치해야 함
    if (s.scoreMax && base.scoreMax && (s.scoreMax.sel !== base.scoreMax.sel || s.scoreMax.cons !== base.scoreMax.cons || s.scoreMax.etc !== base.scoreMax.etc)) {
      issues.push({ severity: '차단', code: 'SCOREMAX_MISMATCH', file: s.sourceName, message: `파트별 만점 상이(선택형/서답형/기타) — 다른 시험 파일 혼입 의심` });
    }
  }

  // 문항정보표 서답형 배점합 ↔ 정오표 서답형 만점 교차검증
  if (info && info.consItems.length > 0) {
    const consSum = info.consItems.reduce((a, i) => a + i.points, 0);
    const consMax = base.scoreMax?.cons ?? 0;
    if (consMax === 0) {
      issues.push({ severity: '경고', code: 'CONS_SCORES_MISSING', message: `문항정보표에 서답형 ${info.consItems.length}문항이 있으나 정오표에 서답형점수가 없음` });
    } else if (Math.abs(consSum - consMax) > 0.005) {
      issues.push({ severity: '경고', code: 'CONS_POINTS_MISMATCH', message: `서답형 배점합 불일치(문항정보표 ${consSum} vs 정오표 만점 ${consMax})` });
    }
  }

  // 학생 병합 + 중복 검사
  const students: RawStudent[] = [];
  const seenIds = new Set<string>();
  const classFiles = new Map<string, number>();
  for (const s of sheets) {
    const classesInFile = new Set<string>();
    for (const st of s.students) {
      classesInFile.add(st.classId);
      if (st.studentId && seenIds.has(st.studentId)) {
        issues.push({ severity: '경고', code: 'DUP_ID', message: `학번 중복(${st.studentId})` });
      }
      if (st.studentId) seenIds.add(st.studentId);
      students.push(st);
    }
    for (const c of classesInFile) classFiles.set(c, (classFiles.get(c) ?? 0) + 1);
  }
  for (const [c, cnt] of classFiles) {
    if (cnt > 1) issues.push({ severity: '경고', code: 'DUP_CLASS', message: `${c}반 파일이 여러 개` });
  }

  // 점수 정합 검증(점수 컬럼이 있는 경우): ①선택형 재구성=선택형점수 ②선택+서답+기타=영역총점
  const selMax = base.points.reduce((a, b) => a + b, 0);
  let sumBad = 0, reconBad = 0;
  for (const st of students) {
    if (!st.scores) continue;
    const { sel, cons, etc } = st.scores;
    if (Math.abs(sel + cons + etc - st.total) > 0.005) sumBad++;
    const missed = st.answers.reduce((a, ans, i) => a + ((ans ?? '').trim() === CORRECT_MARK ? 0 : base.points[i] ?? 0), 0);
    if (Math.abs(selMax - missed - sel) > 0.005) reconBad++;
  }
  if (sumBad > 0) {
    issues.push({ severity: '경고', code: 'SCORE_SUM_MISMATCH', message: `${sumBad}명: 선택형+서답형+기타 ≠ 영역총점 — 원본 파일 확인 필요` });
  }
  if (reconBad > 0) {
    issues.push({ severity: '경고', code: 'SEL_RECON_MISMATCH', message: `${reconBad}명: 정오표 응답으로 재구성한 선택형 점수가 '선택형점수'와 다름 — 복수정답 인정/부분 배점 가능성` });
  }

  const classes = [...new Set(students.map((s) => s.classId))].sort((a, b) => Number(a) - Number(b) || a.localeCompare(b));

  return { students, answerKey: base.answerKey, points: base.points, nQuestions: n, scoreMax: base.scoreMax, classes, meta: base.meta, issues };
}
