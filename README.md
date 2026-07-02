# RunShot

마라톤 배번호(bib) 사진 검색 서비스 (MVP). 참가번호 하나로 자신의 대회 인증샷을 찾는다.

## 스택
- **Backend**: Flask 3.x + SQLAlchemy 2.0(동기) + Flask-Migrate + MySQL 8.0 (PyJWT / bcrypt / Marshmallow)
- **Frontend**: React 18(JavaScript) + Vite + React Router v6 + Axios + Zustand + CSS Modules
- **Worker**: 동기 OCR 워커 (pika + 동기 SQLAlchemy + pytesseract + Pillow)
- **인프라**: MinIO(S3 호환) · Redis(검색 캐시) · RabbitMQ · Docker Compose (앱 서버 / DB 서버 분리)

## 아키텍처
2대 서버로 분리. 업로드는 Presigned URL로 브라우저 → MinIO 직접 전송(서버 우회), OCR은 RabbitMQ 큐로 비동기 처리.

```
App Server (A)                        DB Server (B)
  nginx(80) · api(5000) · worker         mysql(3306) · redis(6379) · minio(9000/9001)
  rabbitmq(5672/15672)
```

업로드 → OCR 파이프라인:
`presigned 발급 → 브라우저가 MinIO로 직접 PUT → complete 통보 → photos(pending) INSERT + ocr_queue 발행 → 워커가 소비: 전처리→Tesseract→배번 추출→썸네일 생성→상태(done/unrecognized) 갱신`

검색: `Redis 캐시(HIT) → 없으면 MySQL 조회 → 사진별 Presigned GET URL(1h) 생성 → 캐시(TTL 10분)`

## 기능 / API
에러 응답은 항상 `{"error": "메시지"}`. 인증은 `Authorization: Bearer <access token>`.
역할 위계: `participant < photographer < organizer < admin`.

| 분류 | 메서드 & 경로 | 권한 |
|---|---|---|
| 인증 | `POST /api/auth/signup` · `POST /api/auth/login` | 공개 |
| | `POST /api/auth/refresh` · `POST /api/auth/logout` · `GET /api/auth/me` | 토큰 |
| 이벤트 | `GET /api/events` · `GET /api/events/:id` (상태 요약 포함) | 공개 |
| | `POST /api/events` · `PUT /api/events/:id` | organizer+ |
| | `DELETE /api/events/:id` (CASCADE) | admin |
| 업로드 | `POST /api/events/:id/upload/presigned` · `POST /api/events/:id/upload/complete` | photographer+ |
| 검색 | `GET /api/events/:id/photos/search?bib=1234` | 공개 |
| 수동 태그 | `GET /api/events/:id/photos/unrecognized` · `POST /api/events/:id/photos/:photoId/tags` | photographer+ |
| 관리자 | `GET /api/admin/users` · `PATCH /api/admin/users/:id/role` | admin |

인증 정책: Access Token(기본 24h, JWT) + opaque Refresh Token(DB 저장, 로그아웃 시 폐기).
업로드 제한: 회당 200장 · 파일당 20MB · JPEG/PNG/WEBP. Presigned PUT 15분 / GET 1시간.

### 프론트 라우트
`/` 랜딩 · `/login` · `/signup` · `/events` · `/events/:id`(배번 검색 폼) · `/events/:id/search?bib=` ·
`/events/:id/upload`(photographer+) · `/events/new`(organizer+) · `/events/:id/edit` · `/admin`
> `VITE_USE_MOCK=true`면 백엔드 없이 더미 데이터로 화면 확인 가능.

## 데이터 모델
5개 테이블: `users` · `refresh_tokens` · `events` · `photos` · `photo_bib_tags`.
- `events → photos → photo_bib_tags`는 CASCADE 삭제, `users` 참조는 RESTRICT.
- 배번 검색은 `ocr_status='done'`만 노출. 수동 태그 추가 시 태그 INSERT와 `ocr_status='done'` UPDATE를 한 트랜잭션으로 처리(BUG-01 방지).

## 디렉토리
```
backend/   Flask API (app/{config,extensions,models,schemas,blueprints,services}, migrations, run.py)
worker/    OCR 워커 (main.py, ocr.py, thumbnail.py, db.py)
frontend/  React (src/{pages,components,api,store,utils})
nginx/     리버스 프록시 설정
docs/      설계 문서
```
각 폴더(`backend/`, `worker/`, `frontend/`)의 `CLAUDE.md`에 세부 개발 규칙이 있다.

## 실행
```bash
cp .env.example .env          # DB_HOST 등 서버 B IP / 시크릿 채우기

# DB 서버(B): mysql, redis, minio
docker compose -f docker-compose.db.yml up -d

# 앱 서버(A): nginx, api, worker, rabbitmq
docker compose -f docker-compose.app.yml up -d

# DB 마이그레이션 (api 컨테이너 내부)
docker compose -f docker-compose.app.yml exec api flask db upgrade
```
사전 준비: MinIO 버킷 `runshot-raw`, `runshot-derived` 생성.

### 로컬 개발 (인프라 없이)
```bash
# backend
cd backend && python -m venv .venv && .venv/bin/pip install -r requirements.txt
.venv/bin/python test_smoke.py     # SQLite 기반 기능 스모크 테스트

# frontend
cd frontend && npm install && VITE_USE_MOCK=true npm run dev
```

## 개발 상태
- ✅ Backend: 인증 · 이벤트 · 업로드 · 검색 · 수동 태그 · 관리자 API + 초기 마이그레이션
- ✅ Frontend: 전 페이지/컴포넌트 + 백엔드 계약에 맞춘 API 클라이언트
- ✅ Worker: OCR 파이프라인(전처리 · Tesseract · 썸네일 · 상태 갱신, JSON 로깅)
- ⏳ 통합 E2E(MinIO/RabbitMQ/Redis 실연동), 시드 데이터 · 데모

> DB 스키마 문서(`docs/`)는 refresh_tokens를 MVP 제외로 두었으나, 팀 결정으로 Refresh Token 전체 흐름을 구현해 테이블을 포함한다.
