# RunShot — 프로젝트 공통 가이드

마라톤 배번호 사진 검색 서비스. 3인 3일 MVP, 로컬 2서버(앱/DB) 환경.

## 스택 (확정 — 변경 금지)
- 백엔드: Flask 3.x + SQLAlchemy 2.0(동기) + Flask-Migrate + MySQL 8.0
- 프론트: React 18(JavaScript) + Vite + React Router v6 + Axios + Zustand + CSS Modules
- 워커: 동기(pika + 동기 SQLAlchemy), RabbitMQ 소비
- 인프라: MinIO(S3 호환), Redis(캐시), RabbitMQ, Docker Compose

## 문서 충돌 시 정답
- FastAPI 언급 → 전부 Flask로 읽는다.
- TypeScript 언급 → JavaScript로 읽는다. Tailwind 언급 → CSS Modules로 읽는다.
- aio-pika/async 워커 언급 → 동기 워커로 읽는다.
- DB 스키마는 docs/DB_SCHEMA.md v1.2가 정본. SYSTEM_ARCHITECTURE §7과 충돌 시 v1.2.

## 폴더 담당
- backend/ : Flask API   worker/ : OCR 워커   frontend/ : React
각 폴더의 CLAUDE.md에 세부 규칙이 있다.

## 버그 픽스 작업 시
- 반드시 [docs/BUGFIX_AGENT_GUIDE.md](docs/BUGFIX_AGENT_GUIDE.md)를 먼저 읽는다.
  (근본원인·최소변경 원칙, FE↔BE·BE↔워커·모델↔마이그레이션 계약, 알려진 함정, 완료 정의)

## 공통 규칙
- 에러 응답은 항상 {"error": "메시지"} 형식(JSON).
- 시간은 UTC 기준, ISO 8601 문자열로 주고받는다.
- 비밀/키는 코드에 하드코딩 금지. .env로 분리(.env.example 유지).

## Git 규칙
- 브랜치: main(항상 동작) ← dev ← feat/* (예: feat/auth, feat/ocr-worker, feat/fe-gallery)
- 커밋: feat: / fix: / docs: / chore: / test: 접두사 사용
- 통합: 매일 오후 3시 중간(feat→dev), 오후 6시 최종(+E2E). Day 완료 시 dev→main.
