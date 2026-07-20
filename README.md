# 지필평가 문항분석

NEIS 문항정보표와 반별 학생답정오표(XLSX/PDF)를 브라우저에서 분석하는 정적 웹앱입니다. 모든 파일 처리는 사용자 브라우저 안에서만 이뤄지며 서버로 전송하지 않습니다.

## 개발

```bash
npm ci
npm run dev
npm test
npm run build:all
```

## 배포

- `dist/`: 정적 웹 호스팅용
- `dist-single/achievement-eval.html`: 서버 없이 실행하거나 GitHub Release에 수동 첨부하는 단일 파일

정답은 학생답정오표의 정답행을 기준으로 하며 A-Z 복수답안 코드도 지원합니다.

상세 설계는 [docs/설계명세서.md](docs/설계명세서.md)를 참고하세요.

v1.1부터는 `main/package.json`을 유휴 시간에 확인해 업데이트를 알리고 다운받을 수 있도록 합니다.
