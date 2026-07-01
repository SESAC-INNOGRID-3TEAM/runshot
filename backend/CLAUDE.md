# Backend — Flask API 규칙

Flask 3.x + SQLAlchemy 2.0(동기) + Flask-Migrate + MySQL 8.0.

## 구조
- app/__init__.py : create_app() 팩토리
- app/config.py : python-dotenv 기반 환경변수
- app/extensions.py : db, migrate, cors, (redis) 초기화
- app/models/ : SQLAlchemy ORM (users, refresh_tokens, events, photos, photo_bib_tags)
- app/schemas/ : Marshmallow 직렬화
- app/blueprints/ : auth, events, photos, admin (전부 url_prefix="/api")
- app/services/ : auth(JWT/bcrypt), storage(MinIO), queue(RabbitMQ) — AWS 교체 대비 추상화
- app/utils/ : 공통 데코레이터/에러 헬퍼

## 규칙
- 모든 라우트 응답 에러는 {"error": "메시지"}.
- 비밀번호 bcrypt 해싱. JWT는 Access Token 위주(MVP), refresh 로직은 후순위(테이블만 유지).
- 권한: @require_role 데코레이터로 처리. 역할 위계 participant < photographer < organizer < admin.
  이벤트 생성/수정은 organizer+, 업로드는 photographer+, 역할변경/이벤트삭제는 admin.
- services/storage.py, services/queue.py는 인터페이스로 추상화(구현 교체 가능하게).
- 업로드 제한: 회당 200장, 파일당 20MB, JPEG/PNG/WEBP. Presigned PUT 900초, GET 3600초.
- 검색 API는 인증 불필요(공개), 결과 없으면 404가 아니라 200 + 빈 배열.
- 수동 태그 추가 시 photo_bib_tags INSERT와 photos.ocr_status='done' UPDATE를 한 트랜잭션으로(BUG-01).

## 금지
- 동기 SQLAlchemy만 사용(async 금지). raw SQL 대신 ORM 파라미터 바인딩.
