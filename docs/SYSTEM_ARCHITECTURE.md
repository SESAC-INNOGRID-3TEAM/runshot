# RunShot — 시스템 아키텍처 설계서

> 버전: v1.1 (MVP)  
> 작성일: 2026-06-29  
> 환경: 로컬 가상머신 2대 (앱 서버 + DB 서버)  
> Phase 2에서 AWS 클라우드 마이그레이션 고려한 설계

---

## 1. 아키텍처 개요

### 1.1 핵심 설계 원칙
1. **이벤트 드리븐 비동기**: 사진 업로드와 OCR 처리를 메시지 큐로 분리
2. **서버 미경유 업로드**: Presigned URL로 앱 서버 부하 없이 스토리지 직접 저장
3. **AWS 마이그레이션 용이성**: 로컬 대체재(MinIO, RabbitMQ, Tesseract)는 AWS SDK 인터페이스와 동일하게 추상화
4. **로컬 2서버 제약**: 모든 서비스를 Docker Compose로 2대 서버에 배분

---

## 2. 서버 구성

```
┌─────────────────────────────────────┐    ┌────────────────────────────────┐
│         앱 서버 (Server A)            │    │       DB 서버 (Server B)         │
│                                     │    │                                │
│  ┌──────────┐  ┌──────────────────┐ │    │  ┌──────────┐                 │
│  │  React   │  │   Flask (BE)     │ │    │  │  MySQL   │  (포트 3306)    │
│  │  (Vite)  │  │   (포트 5000)    │ │    │  └──────────┘                 │
│  │  Nginx   │  └──────────────────┘ │    │                                │
│  │ (포트 80)│                       │    │  ┌──────────┐                 │
│  └──────────┘  ┌──────────────────┐ │    │  │  Redis   │  (포트 6379)    │
│                │  OCR Worker      │ │    │  └──────────┘                 │
│                │  (Python)        │ │    │                                │
│                └──────────────────┘ │    │  ┌──────────┐                 │
│                                     │    │  │  MinIO   │  (포트 9000)    │
│                ┌──────────────────┐ │    │  │ (스토리지)│                 │
│                │  RabbitMQ        │ │    │  └──────────┘                 │
│                │  (포트 5672)     │ │    │                                │
│                └──────────────────┘ │    └────────────────────────────────┘
│                                     │
│        [Docker Compose A]           │         [Docker Compose B]
└─────────────────────────────────────┘
            내부 네트워크 (LAN)
```

### 2.1 앱 서버 (Server A) 컨테이너 목록

| 컨테이너 | 역할 | 포트 | 이미지 |
|---|---|---|---|
| `nginx` | 프론트엔드 정적 서빙 + API 리버스 프록시 | 80, 443 | nginx:alpine |
| `api` | Python Flask 백엔드 (REST API) | 5000 | python:3.11-slim |
| `worker` | OCR 비동기 워커 (pytesseract) | - | python:3.11-slim |
| `rabbitmq` | 메시지 큐 | 5672, 15672 | rabbitmq:3-management |

### 2.2 DB 서버 (Server B) 컨테이너 목록

| 컨테이너 | 역할 | 포트 | 이미지 |
|---|---|---|---|
| `mysql` | 관계형 DB (메인 데이터 저장) | 3306 | mysql:8.0 |
| `redis` | 캐싱 (검색 결과, 세션) | 6379 | redis:7-alpine |
| `minio` | S3 호환 오브젝트 스토리지 | 9000, 9001 | minio/minio |

---

## 3. 기술 스택

| 영역 | MVP (로컬) | Phase 2 (AWS 마이그레이션) |
|---|---|---|
| 프론트엔드 | React (JS, Vite) | 동일 |
| 백엔드 | Python Flask | 동일 |
| DB | MySQL 8.0 | Amazon RDS MySQL |
| 캐시 / 세션 | Redis 7 | Amazon ElastiCache |
| 메시지 큐 | RabbitMQ | Amazon SQS |
| 스토리지 | MinIO | Amazon S3 |
| OCR | Tesseract (pytesseract) | Amazon Rekognition |
| 인증 | JWT (자체 구현, Redis 세션) | Amazon Cognito (optional) |
| 컨테이너 오케스트레이션 | Docker Compose | Amazon ECS / EKS |
| 웹서버/프록시 | Nginx | Amazon ALB + CloudFront |

---

## 4. 업로드 & OCR 파이프라인 (핵심 플로우)

```
[브라우저]
    │
    │ ① POST /api/events/:id/upload/presigned
    │    {filename, content_type, count}
    ▼
[Flask (앱 서버)]
    │
    │ ② MinIO Presigned PUT URL 생성
    │    유효시간: 15분
    ▼
[브라우저]
    │
    │ ③ PUT MinIO Presigned URL (서버 미경유 직접 업로드)
    │    Content-Type: image/jpeg
    ▼
[MinIO (DB 서버)]
    │
    │ ④ 업로드 완료 → 브라우저가 완료 알림 전송
    │
[브라우저]
    │ ⑤ POST /api/events/:id/upload/complete
    │    {storage_key, filename, file_size}
    ▼
[Flask (앱 서버)]
    │ ⑥ photos 테이블에 레코드 INSERT (status: pending)
    │ ⑦ RabbitMQ 'ocr_queue'에 메시지 발행
    │    {photo_id, storage_key, event_id}
    ▼
[RabbitMQ (앱 서버)]
    │ ⑧ 메시지 큐잉
    ▼
[OCR Worker (앱 서버)]
    │ ⑨ 메시지 소비
    │ ⑩ MinIO에서 원본 이미지 다운로드
    │ ⑪ 이미지 전처리 (회색조 변환, 대비 강화, 리사이즈)
    │ ⑫ Tesseract OCR 실행 → 숫자 문자열 추출
    │ ⑬ 2~5자리 숫자 필터링 → 배번 후보 추출
    │ ⑭ 썸네일 생성 (720px) → MinIO derived 버킷에 저장
    │ ⑮ photo_bib_tags 테이블 INSERT
    │     ocr_status: 'done' 또는 'unrecognized'
    ▼
[MySQL (DB 서버)]
    결과 저장 완료
```

---

## 5. 검색 & 갤러리 플로우

```
[브라우저]
    │ GET /api/events/:id/photos/search?bib=1234
    ▼
[Flask]
    │
    ├─ ① Redis 캐시 확인 (key: "search:{event_id}:{bib}")
    │    HIT  → 캐시 결과 반환 (응답 < 50ms)
    │    MISS → ②로 진행
    │
    │ ② MySQL 쿼리
    │    SELECT photos.* FROM photos
    │    JOIN photo_bib_tags ON photos.id = photo_bib_tags.photo_id
    │    WHERE photos.event_id = ? AND photo_bib_tags.bib_number = ?
    │    ORDER BY photos.shot_at ASC
    │
    │ ③ 각 사진에 대해 MinIO Presigned GET URL 생성 (유효: 1시간)
    │ ④ Redis 캐시 저장 (TTL: 10분)
    ▼
[브라우저]
    사진 URL 목록 수신 → 갤러리 렌더링
    │
    │ 사진 직접 요청
    ▼
[MinIO]
    Presigned URL로 이미지 직접 서빙
```

---

## 6. 디렉토리 구조

```
SESAC-INNOGRID-3TEAM/
├── docker-compose.app.yml       # 앱 서버 A 컴포즈 파일
├── docker-compose.db.yml        # DB 서버 B 컴포즈 파일
├── .env.example                 # 환경변수 템플릿
├── README.md                    # 프로젝트 소개 및 실행 방법
│
├── frontend/                    # React (JS, Vite)
│   ├── src/
│   │   ├── pages/               # 라우트별 페이지 컴포넌트
│   │   ├── components/          # 공통 컴포넌트
│   │   ├── hooks/               # 커스텀 훅
│   │   ├── api/                 # API 클라이언트 (axios)
│   │   ├── store/               # 전역 상태 (Zustand)
│   │   └── utils/               # 유틸리티 함수
│   ├── public/
│   ├── nginx.conf               # Nginx 설정 (프로덕션)
│   ├── Dockerfile
│   └── package.json
│
├── backend/                     # Python Flask
│   ├── app/
│   │   ├── __init__.py          # Flask 앱 팩토리 (create_app)
│   │   ├── config.py            # 환경변수 설정
│   │   ├── extensions.py        # db, redis, jwt 확장 초기화
│   │   ├── models/              # SQLAlchemy ORM 모델
│   │   ├── schemas/             # 요청/응답 직렬화 (마슈매로)
│   │   ├── blueprints/          # 라우터 모듈
│   │   │   ├── auth.py
│   │   │   ├── events.py
│   │   │   ├── photos.py
│   │   │   └── admin.py
│   │   └── services/            # 비즈니스 로직
│   │       ├── storage.py       # MinIO 추상화 레이어
│   │       ├── queue.py         # RabbitMQ 퍼블리셔 레이어
│   │       └── auth.py          # JWT 처리
│   ├── migrations/              # Flask-Migrate (Alembic)
│   ├── run.py                   # 앱 진입점
│   ├── Dockerfile
│   └── requirements.txt
│
├── worker/                      # OCR 워커 (독립 프로세스)
│   ├── main.py                  # 워커 진입점
│   ├── ocr.py                   # Tesseract OCR 로직
│   ├── thumbnail.py             # 썸네일 생성 (Pillow)
│   ├── Dockerfile
│   └── requirements.txt
│
├── nginx/
│   └── nginx.conf               # 리버스 프록시 설정
│
└── docs/                        # 프로젝트 문서
    ├── PRD.md
    ├── SYSTEM_ARCHITECTURE.md
    └── VIBE_CODING_GUIDE.md
```

---

## 7. 데이터베이스 스키마 (DDL)

```sql
-- users
CREATE TABLE users (
    id          CHAR(36)     PRIMARY KEY DEFAULT (UUID()),
    email       VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role        ENUM('participant','photographer','organizer','admin')
                NOT NULL DEFAULT 'participant',
    created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- refresh_tokens
CREATE TABLE refresh_tokens (
    id          CHAR(36)     PRIMARY KEY DEFAULT (UUID()),
    user_id     CHAR(36)     NOT NULL,
    token_hash  VARCHAR(255) NOT NULL UNIQUE,
    expires_at  DATETIME     NOT NULL,
    created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- events
CREATE TABLE events (
    id              CHAR(36)     PRIMARY KEY DEFAULT (UUID()),
    name            VARCHAR(255) NOT NULL,
    event_date      DATE         NOT NULL,
    location        VARCHAR(255),
    description     TEXT,
    cover_image_key VARCHAR(500),
    organizer_id    CHAR(36)     NOT NULL,
    created_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (organizer_id) REFERENCES users(id)
);

-- photos
CREATE TABLE photos (
    id                CHAR(36)     PRIMARY KEY DEFAULT (UUID()),
    event_id          CHAR(36)     NOT NULL,
    uploader_id       CHAR(36)     NOT NULL,
    storage_key       VARCHAR(500) NOT NULL,
    thumbnail_key     VARCHAR(500),
    original_filename VARCHAR(255),
    file_size         BIGINT,
    shot_at           DATETIME,
    ocr_status        ENUM('pending','processing','done','unrecognized')
                      NOT NULL DEFAULT 'pending',
    created_at        DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at        DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE,
    FOREIGN KEY (uploader_id) REFERENCES users(id),
    INDEX idx_event_ocr (event_id, ocr_status),
    INDEX idx_shot_at (shot_at)
);

-- photo_bib_tags
CREATE TABLE photo_bib_tags (
    id          CHAR(36)     PRIMARY KEY DEFAULT (UUID()),
    photo_id    CHAR(36)     NOT NULL,
    bib_number  VARCHAR(10)  NOT NULL,
    confidence  FLOAT        DEFAULT 0.0,
    source      ENUM('ocr','manual') NOT NULL DEFAULT 'ocr',
    created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (photo_id) REFERENCES photos(id) ON DELETE CASCADE,
    INDEX idx_bib_search (bib_number, photo_id)   -- 배번 검색 장비 (bib_number 선행)
);
```

---

## 8. MinIO 버킷 구성

| 버킷명 | 용도 | 접근 정책 |
|---|---|---|
| `runshot-raw` | 업로드된 원본 사진 | Private (Presigned URL 전용) |
| `runshot-derived` | 썸네일·리사이즈된 사진 | Private (Presigned URL 전용) |
| `runshot-covers` | 이벤트 커버 이미지 | Public Read (CDN 대체) |

---

## 9. RabbitMQ 큐 설계

| 큐명 | 목적 | Durability | TTL |
|---|---|---|---|
| `ocr_queue` | OCR 처리 작업 | durable | 24시간 |
| `ocr_dlq` | OCR 실패 메시지 (3회 재시도 후) | durable | 7일 |
| `zip_queue` | ZIP 생성 요청 (대용량, 비동기) | durable | 1시간 |

**메시지 포맷 (ocr_queue)**
```json
{
  "photo_id": "uuid",
  "storage_key": "events/evt-001/photo-001.jpg",
  "event_id": "uuid",
  "retry_count": 0,
  "enqueued_at": "2026-06-29T14:00:00Z"
}
```

---

## 10. Nginx 리버스 프록시 설정

```nginx
# /etc/nginx/conf.d/runshot.conf

upstream api {
    server api:5000;
}

server {
    listen 80;
    server_name _;

    # 프론트엔드 정적 파일 서빙
    location / {
        root /usr/share/nginx/html;
        try_files $uri $uri/ /index.html;
    }

    # API 리버스 프록시 (Flask: 포트 5000)
    location /api/ {
        proxy_pass http://api:5000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;

        # 업로드 요청 바디 제한 (presigned URL 방식이므로 메타데이터만 전달)
        client_max_body_size 1M;
    }

    # MinIO 직접 접근 (개발 환경)
    location /minio/ {
        proxy_pass http://minio:9000/;
        proxy_set_header Host $host;
    }
}
```

---

## 11. 환경 변수 (.env)

```bash
# ===== 앱 서버 공통 =====
APP_ENV=local
SECRET_KEY=change-this-secret-key-before-any-use

# ===== DB 서버 연결 =====
DB_HOST=server-b-ip
DB_PORT=3306
DB_NAME=runshot
DB_USER=runshot
DB_PASSWORD=runshot_password

# ===== Redis (세션 / 캐시) =====
REDIS_HOST=server-b-ip
REDIS_PORT=6379
REDIS_SESSION_TTL=3600          # 세션 유효시간 (1시간)

# ===== MinIO (S3 호환) =====
MINIO_ENDPOINT=server-b-ip:9000
MINIO_ACCESS_KEY=change-me-minio-access-key
MINIO_SECRET_KEY=change-me-minio-secret-key
MINIO_BUCKET_RAW=runshot-raw
MINIO_BUCKET_DERIVED=runshot-derived
MINIO_BUCKET_COVERS=runshot-covers
MINIO_PRESIGNED_EXPIRY=900       # 15분 (초)

# ===== RabbitMQ =====
RABBITMQ_HOST=localhost           # 앱 서버 내부
RABBITMQ_PORT=5672
RABBITMQ_USER=runshot
RABBITMQ_PASSWORD=change-me-rabbitmq-password
RABBITMQ_OCR_QUEUE=ocr_queue
RABBITMQ_OCR_DLQ=ocr_dlq

# ===== JWT =====
JWT_ACCESS_EXPIRE_MINUTES=60
JWT_REFRESH_EXPIRE_DAYS=7

# ===== OCR =====
TESSERACT_CMD=/usr/bin/tesseract
OCR_MIN_CONFIDENCE=0.6
BIB_MIN_DIGITS=2
BIB_MAX_DIGITS=5
```

---

## 12. AWS 마이그레이션 매핑 (Phase 2)

| 로컬 (MVP) | AWS (Phase 2) | 변경 사항 |
|---|---|---|
| MinIO | Amazon S3 | `.env`의 엔드포인트·키만 교체, boto3 코드 그대로 |
| RabbitMQ | Amazon SQS | `services/queue.py` 어댑터 교체 |
| Tesseract OCR | Amazon Rekognition | `worker/ocr.py` 어댑터 교체 |
| MySQL (로컬) | Amazon RDS MySQL | 연결 문자열만 교체 |
| Redis (로컬) | Amazon ElastiCache | 연결 문자열만 교체 |
| Nginx | Amazon ALB + CloudFront | 인프라 레이어 교체 |
| Docker Compose | Amazon ECS Fargate | IaC(Terraform/CDK) |

> **설계 원칙**: 각 외부 서비스는 `services/` 레이어에서 인터페이스로 추상화하여
> 로컬 → AWS 마이그레이션 시 비즈니스 로직 변경 없이 어댑터만 교체 가능하도록 한다.

---

## 13. 보안 설계

| 항목 | 구현 방식 |
|---|---|
| 비밀번호 저장 | bcrypt 해싱 (cost factor 12) |
| API 인증 | JWT Bearer Token (Authorization 헤더) + Redis 세션 관리 |
| 사진 접근 제어 | MinIO Presigned GET URL (유효 1시간) |
| SQL Injection 방지 | SQLAlchemy ORM 파라미터 바인딩 |
| XSS 방지 | React 기본 이스케이핑 + CSP 헤더 |
| CORS | 허용 오리진 명시적 설정 (Flask-CORS) |
| 프라이버시 | 본인 배번 검색만 허용 (타인 사진 접근 불가) |

---

## 14. 모니터링 (로컬 환경)

| 항목 | 도구 | 접근 URL |
|---|---|---|
| RabbitMQ 관리 콘솔 | RabbitMQ Management UI | http://server-a:15672 |
| MinIO 콘솔 | MinIO Console | http://server-b:9001 |
| API 문서 | FastAPI Swagger UI | http://server-a/api/docs |
| DB 관리 | phpMyAdmin (옵션) | http://server-b:8080 |
| 컨테이너 상태 | docker stats | CLI |
