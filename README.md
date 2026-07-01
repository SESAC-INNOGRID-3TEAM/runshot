# RunShot

마라톤 배번호 사진 검색 서비스 (MVP).

## 스택
- Backend: Flask 3.x + SQLAlchemy 2.0(동기) + Flask-Migrate + MySQL 8.0
- Frontend: React 18(JavaScript) + Vite + React Router v6 + Axios + Zustand + CSS Modules
- Worker: 동기 OCR 워커 (pika + 동기 SQLAlchemy + pytesseract)
- 인프라: MinIO, Redis, RabbitMQ, Docker Compose (앱 서버 / DB 서버 분리)

## 문서
- [docs/SYSTEM_ARCHITECTURE.md](docs/SYSTEM_ARCHITECTURE.md) — 아키텍처 개요
- DB 스키마 정본: v1.2 기준(refresh_tokens 테이블 포함, BUG-01 수동 태그 트랜잭션 수정 반영).
  ⚠️ docs/ 내 DB 스키마 문서 파일명이 세션 중 `RunShot_DB_Schema_MVP_2026-07-01.md`(v1.0, refresh_tokens 제외)로
  바뀐 것을 확인함 — 본 스캐폴드는 대화에서 확정된 지침(v1.2, refresh_tokens 유지)을 따랐다.
  문서와 실제 정책이 어긋나 있으니 팀 내 확인 필요.

각 폴더(backend/, worker/, frontend/)의 CLAUDE.md에 세부 개발 규칙이 있다.

## 실행 (예정)
```
cp .env.example .env
docker compose -f docker-compose.db.yml up -d
docker compose -f docker-compose.app.yml up -d
```

## 개발 상태
현재는 프로젝트 스캐폴드 단계. 기능 구현은 각 담당 폴더에서 진행.
