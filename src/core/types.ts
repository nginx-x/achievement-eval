// ─────────────────────────────────────────────────────────────
// core/types.ts — 도메인 타입 단일 진실원 (UI/DOM 의존 0)
// ─────────────────────────────────────────────────────────────

export type Difficulty = '어려움' | '보통' | '쉬움' | '미상';
export type ItemType = '선택형' | '서답형';
/** 학생답정오표 정답 행의 정규화된 코드: '1'..'5', 'A'..'Z', 또는 누락. */
export type AnswerCode = string | null;
export type AchievementLevel = 'A' | 'B' | 'C' | 'D' | 'E';
export const LEVELS: AchievementLevel[] = ['A', 'B', 'C', 'D', 'E'];

/** 성취수준 분할점수(원점수 기준). 기본 90/80/70/60. */
export interface Cutoffs {
  AB: number;
  BC: number;
  CD: number;
  DE: number;
}

// ── 입력 파싱 결과 ──────────────────────────────────────────

/** 문항정보표 1개 문항 */
export interface ItemInfo {
  qno: number;
  area: string; // 내용영역
  standard: string; // 성취기준 (예: [9사(지리)07-01] …)
  difficulty: Difficulty; // 출제자 예상난이도
  points: number; // 배점
  answer: number | null; // 정답(선택형). 서답형은 null
  type: ItemType;
}

export interface ItemInfoTable {
  subject: string;
  grade: string;
  examName: string;
  totalScore: number; // 총점(문항정보표 기준)
  items: ItemInfo[]; // 선택형 문항(정오표 응답 컬럼과 1:1)
  /** 서답형 문항 메타(번호는 서답형 자체 번호 1..). 정오표엔 문항별 점수가 없어 참고용. */
  consItems: ItemInfo[];
}

/** 정오표 셀: '.'=정답, '1'~'5'=단일 응답, 'A'~'Z'=복수응답 조합, ''=무표기/공백 */
export type Cell = string;

/** 정오표 점수 컬럼(선택형점수·서답형점수·기타점수). 배점행에서 읽으면 각 파트의 만점. */
export interface ScoreParts {
  sel: number; // 선택형점수
  cons: number; // 서답형점수
  etc: number; // 기타점수
}

/** 파싱 직후(가명화 전) — name/studentId 는 transient, 저장·전송 금지 */
export interface RawStudent {
  classId: string; // 반 (예: '1')
  seat: string; // 반 내 번호 (예: '1')
  studentId: string; // 학번 (원본, transient)
  name: string; // 이름 (원본, transient)
  answers: Cell[]; // 문항별 응답
  total: number; // 영역총점
  scores: ScoreParts | null; // 선택형·서답형·기타 점수(컬럼 없으면 null)
}

export interface Marksheet {
  meta: {
    schoolYear?: string;
    semester?: string;
    grade?: string;
    classId?: string;
    examName?: string;
    subject?: string;
  };
  answerKey: AnswerCode[];
  points: number[];
  nQuestions: number;
  students: RawStudent[];
  scoreMax: ScoreParts | null; // 배점행의 선택형·서답형·기타 만점(컬럼 없으면 null)
  sourceName: string; // 파일명(역할/반 인식용)
}

// ── 가명화 후(저장/분석 대상) ───────────────────────────────

export interface Student {
  id: string; // 학번(없으면 반/번호)
  name: string; // 학생 이름 — 완전 로컬 처리(서버 전송·저장 없음)
  classId: string;
  seat: string; // 반 내 번호
  answers: Cell[];
  total: number;
  scores: ScoreParts | null; // 선택형·서답형·기타 점수(컬럼 없으면 null)
}

export interface Dataset {
  itemInfo: ItemInfo[]; // 선택형 문항 메타
  consItems: ItemInfo[]; // 서답형 문항 메타(참고용)
  answerKey: AnswerCode[];
  points: number[];
  nQuestions: number;
  scoreMax: ScoreParts | null; // 정오표 배점행의 파트별 만점
  students: Student[];
  classes: string[];
  meta: Marksheet['meta'];
}

// ── 분석 결과 ────────────────────────────────────────────────

export type FlagLevel = '심각' | '주의' | '점검';
export interface Flag {
  level: FlagLevel;
  code: string; // 기계 판독용 (예: 'REVERSAL', 'NEG_DISC', 'DIFF_MISMATCH')
  message: string; // 사람용 설명
}

export interface LevelRate {
  level: AchievementLevel;
  n: number;
  p: number | null; // 정답률(0..1), 집단 없으면 null
}

/** 성취수준 × 보기별 답지반응 분포(문항별 교차표, A2) */
export interface LevelOptionDist {
  level: AchievementLevel;
  n: number;
  dist: Record<string, number>; // '1'..'5','무응답','기타' → 선택 비율(0..1)
}

/** 복수정답 문항의 정확 조합 분포와 선택지 포함률. */
export interface MultiAnswerSummary {
  answerCode: string;
  answerOptions: number[];
  /** 정확한 응답 조합별 비율. key: A..Z, 1..5, 무응답, 기타 */
  combination: Record<string, number>;
  combinationByLevel: LevelOptionDist[];
  /** 각 선택지를 포함한 학생 비율. 복수선택이므로 합계가 100%를 넘을 수 있다. */
  optionSelection: Record<string, number>;
  optionSelectionByLevel: LevelOptionDist[];
}

/** 인접 성취수준 간 정답률 격차 (경계 결정 문항) */
export interface LevelGap {
  boundary: string; // 'A/B' | 'B/C' | 'C/D' | 'D/E'
  upperP: number | null;
  lowerP: number | null;
  gap: number | null; // upperP − lowerP (양수면 정상 방향)
}

export interface ItemStat {
  qno: number;
  type: ItemType;
  difficulty: Difficulty;
  points: number;
  answer: AnswerCode;
  p: number; // 정답률(선택형) 또는 평균 획득률(서답형)
  discrimination: number; // KICE 방식 비교정 문항-총점 상관
  pByLevel: LevelRate[];
  /** 보기별 선택 비율(0..1). key: '1'..'5','무응답','기타' */
  distractor: Record<string, number>;
  /** 성취수준 × 보기별 답지반응 교차표 (A2) */
  distractorByLevel: LevelOptionDist[];
  /** 인접 수준 정답률 격차 (A/B·B/C·C/D·D/E) */
  levelGaps: LevelGap[];
  /** 격차가 임계 이상인 최대 경계 = 이 문항이 결정짓는 성취수준 경계 */
  decidesBoundary: { boundary: string; gap: number } | null;
  /** 대표문항(경계문항) 해당 수준: 그 수준 ≥2/3 & 바로 아래 <2/3 (E는 아래 없음) */
  representsLevels: AchievementLevel[];
  noResponseRate: number;
  multiAnswer: MultiAnswerSummary | null;
  flags: Flag[];
}

export interface Reliability {
  alpha: number;
  k: number;
  nStudents: number;
  sem: number; // 측정의 표준오차 = SD·√(1−α)
}

export interface LevelSummary {
  level: AchievementLevel;
  n: number;
  ratio: number; // 0..1
  meanRaw: number;
  sdRaw: number;
}

export interface AchievementSummary {
  cutoffs: Cutoffs;
  distribution: LevelSummary[];
  overall: { n: number; mean: number; sd: number; min: number; max: number };
  /** 반별 분포·평균·표준편차 (A4) */
  byClass: { classId: string; counts: Record<AchievementLevel, number>; n: number; mean: number; sd: number }[];
}

export interface DiffMismatch {
  qno: number;
  expected: Difficulty;
  p: number;
  reason: string;
}

export interface ExpectedVsActual {
  tauB: number | null; // Kendall τ-b (예상난이도 순위 vs 실제난이도 1-P)
  meanPByDifficulty: { difficulty: Difficulty; n: number; meanP: number }[];
  mismatches: DiffMismatch[];
}

export interface StandardRollup {
  standard: string;
  area: string;
  nItems: number;
  totalPoints: number;
  meanP: number;
  meanDiscrimination: number;
  achievementRate: number; // 배점가중 전체 성취율(0..1) — 원본 앱 '성취율'
  achievementByLevel: LevelRate[]; // 배점가중 수준별 성취율 (A3)
}

/** 반별 문항 정답률 (A4) */
export interface ClassItemRates {
  classId: string;
  n: number;
  rates: (number | null)[]; // 문항별 정답률(0..1)
}

/**
 * 서답형 분석(라이브 앱 '서답형 문항 분석 결과' 대응).
 * NEIS 정오표에는 서답형 문항별 점수가 없어 '서답형점수' 합계를 단일 의사문항으로 분석.
 */
export interface ConstructedSummary {
  maxPoints: number; // 서답형 만점(배점행)
  n: number; // 유효 학생수
  min: number; // 관측 최소
  max: number; // 관측 최대
  mean: number;
  sd: number;
  rate: number; // 평균 획득률 = mean / maxPoints
  discrimination: number; // KICE 방식 비교정: 서답형점수 ↔ 총점
  byLevel: { level: AchievementLevel; n: number; mean: number; rate: number | null }[];
  byClass: { classId: string; n: number; mean: number; rate: number }[];
  /** 부분점수 분포(관측 점수값별) */
  scoreDist: { score: number; n: number; ratio: number }[];
  /** 성취수준 × 부분점수 분포. dist key = 점수값 문자열(예: '4', '7.5') → 비율 */
  distByLevel: { level: AchievementLevel; n: number; dist: Record<string, number> }[];
  items: ItemInfo[]; // 문항정보표 서답형 메타(있으면)
  flags: Flag[];
}

export interface RiskSummary {
  counts: Record<FlagLevel, number>;
  flaggedItems: { qno: number; flags: Flag[] }[];
  narrative: string; // 자동 생성 요약 문장
}

export interface AnalysisResult {
  meta: Marksheet['meta'];
  nStudents: number;
  nQuestions: number;
  classes: string[];
  reliability: Reliability;
  items: ItemStat[];
  achievement: AchievementSummary;
  expectedVsActual: ExpectedVsActual;
  standards: StandardRollup[];
  classItemRates: ClassItemRates[]; // 반별 문항 정답률 (A4)
  constructed: ConstructedSummary | null; // 서답형 분석(서답형 없으면 null)
  risk: RiskSummary;
  /** 부분 데이터(누락 반 등) 여부 — 워터마크/잠정라벨용 */
  partial?: { reason: string };
}

// ── 업로드/검증 ─────────────────────────────────────────────

export type ValidationSeverity = '차단' | '경고';
export interface ValidationIssue {
  severity: ValidationSeverity;
  code: string;
  message: string;
  file?: string;
}
