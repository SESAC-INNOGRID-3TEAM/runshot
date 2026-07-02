# RunShot — 버그 픽스 에이전트 가이드

> 이 문서는 **버그 수정 작업을 수행하는 LLM 에이전트**를 위한 규칙서다.
> 목표: 프로젝트 틀을 벗어나지 않고, 최소 변경으로, 근본 원인을 고친다.
> 먼저 루트 `CLAUDE.md`와 대상 폴더(`backend/` · `worker/` · `frontend/`)의 `CLAUDE.md`를 읽어라. 충돌 시 그 규칙이 우선한다.

---

## 0. 황금률 (매 작업 반복)

1. **재현이 먼저다.** 재현 못 한 버그는 고치지 않는다. 재현 절차를 남겨라.
2. **증상이 아니라 근본 원인.** 고치기 전에 문제 함수의 **모든 호출부를 grep**하라. 한 곳이 아니라 공통 지점에서 고친다.
3. **최소 변경(diff).** 리팩터링·기능 추가·의존성 추가·스타일 정리 금지. 티켓 범위 밖은 건드리지 않는다.
4. **확정 스택을 바꾸지 않는다.** (아래 §1)
5. **고친 뒤 반드시 검증.** 실패하던 재현이 통과하고, 기존 테스트/스모크가 깨지지 않음을 확인한다.
6. 불확실하면 멈추고 질문한다. 추측으로 넓게 고치지 않는다.

---

## 1. 절대 바꾸지 않는 것 (확정 스택·규칙)

- **백엔드**: Flask 3.x + **동기** SQLAlchemy 2.0 + Flask-Migrate + MySQL 8.0. `async` 금지.
- **프론트**: React 18 **JavaScript(.jsx)** + Vite + React Router v6 + Axios + Zustand + **CSS Modules**. TypeScript·Tailwind 금지.
- **워커**: 동기(pika BlockingConnection + 동기 SQLAlchemy + pytesseract + Pillow).
- **인프라**: MinIO(S3 호환) · Redis · RabbitMQ · Docker Compose(앱 서버 A / DB 서버 B 분리).
- 새 라이브러리·프레임워크를 임의로 추가하지 않는다. 몇 줄로 되는 건 몇 줄로 한다.
- FastAPI/TypeScript/Tailwind/aio-pika 언급이 문서에 보이면 각각 Flask/JS/CSS Modules/동기로 읽는다.

---

## 2. 반드시 지키는 공통 규칙

| 규칙 | 내용 |
|---|---|
| 에러 응답 | 항상 `{"error": "메시지"}` (JSON). 헬퍼 `app/utils/error(msg, status)` 사용. |
| 시간 | UTC 기준, ISO 8601 문자열로 주고받는다. |
| 비밀/키 | 코드 하드코딩 금지. `.env`로 분리(`.env.example` 유지). |
| SQL | ORM 파라미터 바인딩만. raw SQL·문자열 포매팅 쿼리 금지. |
| 인증 | `Authorization: Bearer <access token>`. 데코레이터 `@require_auth` / `@require_role(min)` 사용. |
| 권한 위계 | `participant < photographer < organizer < admin`. 이벤트 생성/수정=organizer+, 업로드/수동태그=photographer+, 역할변경/이벤트삭제=admin. |
| 검색 API | 인증 불필요(공개). 결과 없으면 **404 아님 → 200 + 빈 배열**. |
| 서비스 추상화 | `services/storage.py`(MinIO), `services/queue.py`(RabbitMQ)는 인터페이스로. AWS 교체가 이 파일 교체만으로 되게 유지. 비즈니스 로직에 SDK 직접 노출 금지. |

---

## 3. 코드 지도 (어디를 고치나)

```
backend/app/
  config.py        환경변수 → Config (여기 없는 설정값을 코드에 하드코딩하지 말 것)
  extensions.py    db, migrate, cors, redis_client
  models/          ORM 5개: user, refresh_token, event, photo, photo_bib_tag  (+ base.py: uuid_pk/타임스탬프)
  schemas/         Marshmallow 직렬화·이벤트 입력 검증
  blueprints/      auth · events · photos · admin  (라우트는 전부 /api/*)
  services/        auth(JWT/bcrypt) · storage(MinIO) · queue(RabbitMQ)
  utils/           error(), require_auth, require_role
  migrations/      Alembic. 모델 바꾸면 반드시 마이그레이션도.
worker/            main.py(소비 루프) · ocr.py · thumbnail.py · db.py(독립 세션)
frontend/src/
  api/             axios 클라이언트 — 백엔드 계약과 맞추는 유일한 seam. mock 모드 분기 포함.
  pages/ components/ store/ utils/
```

**층을 지켜라**: 라우트(blueprint)는 얇게, 외부 시스템 접근은 `services/`, 검증/직렬화는 `schemas/`. 라우트 안에서 MinIO/pika를 직접 부르지 말고 서비스 함수를 통해라.

---

## 4. 절대 깨면 안 되는 계약 (통합 버그가 여기서 난다)

이번 스프린트의 실버그 3개는 전부 아래 "계약 불일치"에서 나왔다. 관련 파일을 고칠 땐 **양쪽을 함께** 확인하라.

### 4.1 프론트 ↔ 백엔드 API 계약
- FE는 `frontend/src/api/*.js`에서만 백엔드를 호출한다(baseURL `/api`). 컴포넌트는 이 계층이 정규화한 형태를 소비한다.
- **엔드포인트를 바꾸면 `frontend/src/api/`의 해당 함수도 같이 고쳐라.** 경로·요청 필드·응답 envelope 모두.
- 정본 경로(임의 변경 금지):

| 기능 | 경로 |
|---|---|
| 인증 | `POST /api/auth/{signup,login,refresh,logout}` · `GET /api/auth/me` |
| 이벤트 | `GET /api/events` · `GET /api/events/:id`(응답에 `summary`) · `POST /api/events` · `PUT /api/events/:id` · `DELETE /api/events/:id` |
| 업로드 | `POST /api/events/:id/upload/presigned` · `POST /api/events/:id/upload/complete` |
| 검색 | `GET /api/events/:id/photos/search?bib=` |
| 수동태그 | `GET /api/events/:id/photos/unrecognized` · `POST /api/events/:id/photos/:photoId/tags` |
| 관리자 | `GET /api/admin/users` · `PATCH /api/admin/users/:id/role` |

- 응답 규약: 목록은 `{events|users|photos: [...]}`로 감싼다. 검색은 `{bib_number, event_id, total, photos:[{photo_id, thumbnail_url, original_url, shot_at, confidence}]}`.

### 4.2 백엔드(발행) ↔ 워커(소비) 큐 계약  ← **버그 #3 발생 지점**
- 큐 이름 `ocr_queue`. `backend/app/services/queue.py`와 `worker/main.py`의 **`queue_declare` 인자가 완전히 일치**해야 한다.
  - `durable=True`, `arguments={"x-message-ttl": 86400000}` (24h, SYSTEM_ARCHITECTURE §9).
  - 인자가 다르면 RabbitMQ가 `PRECONDITION_FAILED (406)`로 거부 → 발행이 조용히 실패한다.
- 메시지 스키마: `{"photo_id", "storage_key", "event_id", "retry_count", "enqueued_at"}`. 필드를 바꾸면 발행·소비 양쪽 다 고친다. 메시지는 persistent(`delivery_mode=2`).
- MVP에 DLQ 없음. 실패 시 사진을 `unrecognized`로 두는 방식이다(재시도/DLQ 도입 금지).

### 4.3 모델 ↔ 마이그레이션 ↔ DB 스키마
- 테이블 5개: `users` · `refresh_tokens` · `events` · `photos` · `photo_bib_tags`.
- 관계: `events → photos → photo_bib_tags` **CASCADE 삭제**, `users` 참조는 **RESTRICT**.
- **모델을 바꾸면 마이그레이션을 같이 만든다.** (`flask db migrate` 후 생성물 검토, 또는 `0001_initial.py`처럼 수기 작성. MySQL 타입 주의: `CHAR(36)`, `ENUM`, `SMALLINT/INT UNSIGNED`는 `sqlalchemy.dialects.mysql` 타입 사용.)
- **UUID PK는 파이썬 측 default(`lambda: uuid4`)로 flush 시점에 채번된다.** commit/flush **전에 `obj.id`를 읽으면 `None`**이다. ← **버그 #2**. id가 필요하면 `db.session.flush()` 후 읽어라.
- `expire_on_commit` 기본 True: commit 후 객체 속성 접근은 재조회(SELECT)를 유발한다. 대량 처리 경로에선 flush 후 미리 값을 확보하라.

### 4.4 OCR 상태 머신 & 검색 가시성
- `ocr_status`: `pending → processing → (done | unrecognized)`.
- **검색은 `ocr_status='done'`만 노출.** 태그가 있어도 상태가 done이 아니면 검색에 안 나온다.
- **수동 태그(BUG-01)**: `photo_bib_tags` INSERT와 `photos.ocr_status='done'` UPDATE를 **한 트랜잭션**으로. 둘 중 하나만 하면 사진이 검색에서 영구 누락되거나 유령 상태가 된다.

### 4.5 스토리지 / Presigned URL
- 원본 버킷 `runshot-raw`, 파생(썸네일) `runshot-derived`. 둘 다 private → 항상 presigned URL.
- 업로드 제한: 회당 200장, 파일당 20MB, JPEG/PNG/WEBP. Presigned PUT 15분 / GET 1시간.
- **Presigned URL의 호스트는 브라우저가 접근 가능한 주소여야 한다.** 워커가 내부에서 접근하는 주소와 다를 수 있으니 endpoint를 바꿀 땐 양쪽을 고려하라. Minio 클라이언트엔 `region`을 지정한다(서명 시 불필요한 `GetBucketLocation` 네트워크 호출 회피 — **버그 #1**).

### 4.6 외부 시스템 장애 내성
- Redis(검색 캐시)·RabbitMQ(발행)가 죽어도 요청 자체는 죽지 않게 이미 방어돼 있다(캐시 미스 시 DB 폴백, 발행 실패는 로깅 후 진행). 이 방어를 제거하지 마라.

---

## 5. 버그 픽스 워크플로 (권장 순서)

1. **재현**: 실패를 눈으로 확인(요청/로그/스택트레이스). 가능하면 실패하는 최소 케이스를 스크립트/테스트로.
2. **원인 추적**: 스택트레이스 → 해당 함수 → **호출부 전부 grep** → §4 계약 중 무엇이 깨졌는지 판단.
3. **수정**: 공통 지점에서 최소 변경. 계약이 얽혀 있으면 양쪽(FE/BE, BE/worker, model/migration)을 함께.
4. **검증**:
   - 인프라 없이: `backend/.venv/bin/python backend/test_smoke.py` (SQLite), FE는 `npm run build`.
   - 통합 필요 시: §6으로 전체 스택 띄워 재현 케이스 재실행.
5. **자가 점검 추가**: 사소하지 않은 로직(분기/루프/트랜잭션/메시지)에는 실패를 잡아내는 최소 검사 1개를 남긴다. `test_smoke.py`에 assert 추가로 충분(프레임워크 도입 불필요).
6. **커밋**: §7 규칙대로.

---

## 6. 로컬 실행 & 검증 (인프라)

- **인프라 없이(빠름)**: backend는 SQLite로 스모크 테스트(`test_smoke.py`), frontend는 `VITE_USE_MOCK=true npm run dev`.
- **전체 스택(E2E)**: `docker-compose.db.yml`(mysql/redis/minio) → 버킷 `runshot-raw`,`runshot-derived` 생성 → `docker-compose.app.yml`(nginx/api/worker/rabbitmq) → `flask db upgrade`.
- 로컬 단일 머신 주의점:
  - 앱 컨테이너는 DB 서버 서비스에 `host.docker.internal`로, 같은 compose 내 `rabbitmq`엔 서비스명으로 접근.
  - macOS는 5000을 ControlCenter(AirPlay)가 점유 → api를 5001로 게시하기도 한다.
  - 큐 인자 불일치(§4.2)면 OCR이 조용히 멈춘다. 워커 로그에 `worker_started`만 있고 처리 로그가 없으면 이걸 의심.
- **로컬 전용 파일은 커밋 금지**: `.env`, `docker-compose.local.yml`, `frontend/vite.local.config.js` (`.gitignore`에 있음).

---

## 7. Git 규칙

- `dev`에서 분기: `fix/<간단한-설명>` (또는 기능성이면 `feat/*`). `main`에 직접 커밋 금지.
- 커밋 접두사: `fix:` / `feat:` / `docs:` / `chore:` / `test:`.
- 커밋은 **논리 단위로 분리**한다(예: 백엔드 버그픽스와 프론트 조정은 별도 커밋). 사용자가 요청할 때만 커밋/푸시한다.
- 커밋 메시지 본문에 **근본 원인과 수정 요지**를 한두 줄로. 마지막 줄:
  ```
  Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
  ```
- **다른 담당 폴더(FE/worker)를 고쳐야 하면** 계약 정합성을 먼저 확인하고, 변경 이유를 커밋/설명에 남긴다. 남의 영역을 조용히 바꾸지 않는다.
- `.env`·로컬 override·`node_modules`·`.venv`·`dist`는 커밋하지 않는다.

---

## 8. 알려진 함정 (반복 실수 방지)

- **큐 선언 인자 불일치** → 발행 조용히 실패 (§4.2, 버그 #3).
- **commit 전 `obj.id` 접근 → None** (§4.3, 버그 #2). `flush()` 후 읽어라.
- **Minio region 미지정 → 매 presigned마다 네트워크 호출/하드 실패** (§4.5, 버그 #1).
- **검색이 비었는데 404 반환** → 규칙 위반. 200 + 빈 배열.
- **수동 태그 시 상태 UPDATE 누락** → 검색 영구 누락 (§4.4).
- 모델만 고치고 마이그레이션 누락 → 배포/통합에서 스키마 불일치.
- FE 경로만 고치고 응답 envelope 매핑 누락(또는 그 반대) → 화면이 빈 데이터.
- vite dev가 IPv6(`::1`)에 바인딩 → `127.0.0.1`로 접속 실패할 수 있음(테스트 스크립트 이슈, 제품 버그 아님).

---

## 9. 완료 정의 (Definition of Done)

- [ ] 재현되던 실패가 더 이상 재현되지 않는다(절차 명시).
- [ ] 근본 원인 지점 한 곳에서 고쳤고, 같은 원인의 형제 호출부도 안전하다.
- [ ] §1~§4의 어떤 규칙·계약도 새로 깨지 않았다.
- [ ] `test_smoke.py`(및 관련 검증)가 통과한다. 필요 시 회귀 검사 1개 추가.
- [ ] diff가 버그 범위로 한정된다(무관한 리팩터/포맷 변경 없음).
- [ ] 모델 변경 시 마이그레이션 동반, 계약 변경 시 반대편(FE/worker) 동반.
- [ ] 커밋 메시지에 원인·수정 요지 기록.
