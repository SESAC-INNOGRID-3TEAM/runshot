# RunShot - DB Schema Design (MVP)

| | |
|---|---|
| **Version** | v1.0 (MVP) |
| **Date** | 2026-07-01 |
| **DB** | MySQL 8.0 |
| **Design Principle** | 3-person, 3-day sprint - fast implementation over normalization |

---

## Design Direction (설계 방향)

| Principle | Description |
|---|---|
| **Minimize Tables** | 4 tables only (refresh_tokens excluded) |
| **Relaxed Normalization** | Denormalize for frequently JOINed data |
| **Minimal Indexes** | Index only for actually used queries |
| **Simple Types** | Prefer VARCHAR, INT over complex types |
| **MVP Scope** | Refresh Token, cover image, ZIP, DLQ excluded |

---

## ERD Overview

```
users
  |
  +-- (1:N) events        [organizer_id -> users.id]
  |
  +-- (1:N) photos        [uploader_id -> users.id]
                |
                +-- (1:N) photo_bib_tags  [photo_id -> photos.id]
                          events --> photos (1:N) [event_id -> events.id]
```

---

## Table List (테이블 목록)

| # | Table | Role | Note |
|---|---|---|---|
| 1 | `users` | User accounts & roles | |
| 2 | `events` | Marathon events | |
| 3 | `photos` | Uploaded photos + OCR status | includes thumbnail_key |
| 4 | `photo_bib_tags` | Bib number tags (OCR/manual) | |

> `refresh_tokens` table is **excluded from MVP** (REQ-1.2). Access Token only.

---

## DDL

```sql
-- ============================================================
-- RunShot DB Schema v1.0 (MVP)
-- MySQL 8.0
-- 3-person, 3-day sprint simplified version
-- ============================================================

SET NAMES utf8mb4;
SET time_zone = '+00:00';


-- ------------------------------------------------------------
-- 1. users
--    Role: User account + role management
--    MVP: Access Token only -> no refresh_tokens table
-- ------------------------------------------------------------
CREATE TABLE users (
    id            CHAR(36)     NOT NULL DEFAULT (UUID()),
    email         VARCHAR(255) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,

    -- MVP: Keep all 4 roles, but API access control simplified to admin/non-admin
    role          ENUM('participant','photographer','organizer','admin')
                               NOT NULL DEFAULT 'participant',

    created_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP
                               ON UPDATE CURRENT_TIMESTAMP,

    PRIMARY KEY (id),
    UNIQUE KEY uq_users_email (email)

) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;


-- ------------------------------------------------------------
-- 2. events
--    Role: Marathon event creation/management
--    MVP: Cover image upload excluded (text card UI instead)
--    MVP: No pagination, full list sorted by latest
-- ------------------------------------------------------------
CREATE TABLE events (
    id           CHAR(36)     NOT NULL DEFAULT (UUID()),
    organizer_id CHAR(36)     NOT NULL,  -- users.id (event creator)
    name         VARCHAR(255) NOT NULL,
    event_date   DATE         NOT NULL,
    location     VARCHAR(255) NOT NULL DEFAULT '',
    description  TEXT,

    created_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP
                              ON UPDATE CURRENT_TIMESTAMP,

    PRIMARY KEY (id),

    CONSTRAINT fk_events_organizer
        FOREIGN KEY (organizer_id) REFERENCES users(id) ON DELETE RESTRICT,

    -- Event list sorted by latest
    INDEX idx_events_created_at (created_at)

) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;


-- ------------------------------------------------------------
-- 3. photos
--    Role: Uploaded photo metadata + OCR processing status
--    Denormalized: thumbnail_key included as column (no separate table)
--    shot_at: EXIF or upload time (NULL allowed -> fallback to created_at)
-- ------------------------------------------------------------
CREATE TABLE photos (
    id                CHAR(36)     NOT NULL DEFAULT (UUID()),
    event_id          CHAR(36)     NOT NULL,
    uploader_id       CHAR(36)     NOT NULL,

    -- MinIO original key: "raw/events/{event_id}/{uuid}.jpg"
    storage_key       VARCHAR(512) NOT NULL,

    -- OCR worker generated thumbnail: "derived/events/{event_id}/{uuid}_thumb.jpg"
    -- NULL before worker processing
    thumbnail_key     VARCHAR(512) NULL DEFAULT NULL,

    original_filename VARCHAR(255) NOT NULL DEFAULT '',
    file_size         INT UNSIGNED NOT NULL DEFAULT 0,  -- bytes

    -- EXIF shot time (NULL -> fallback to created_at for search sorting)
    shot_at           DATETIME     NULL,

    -- OCR processing status
    -- pending       : upload complete, waiting in queue
    -- processing    : worker is processing
    -- done          : OCR success or manual tag complete -> searchable
    -- unrecognized  : OCR failed, no manual tag -> excluded from search
    ocr_status        ENUM('pending','processing','done','unrecognized')
                                   NOT NULL DEFAULT 'pending',

    created_at        DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at        DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP
                                   ON UPDATE CURRENT_TIMESTAMP,

    PRIMARY KEY (id),

    CONSTRAINT fk_photos_event
        FOREIGN KEY (event_id)    REFERENCES events(id) ON DELETE CASCADE,

    CONSTRAINT fk_photos_uploader
        FOREIGN KEY (uploader_id) REFERENCES users(id)  ON DELETE RESTRICT,

    -- Prevent duplicate storage_key
    UNIQUE KEY uq_photos_storage_key (storage_key),

    -- For unrecognized list query (REQ-5.4.1)
    INDEX idx_photos_event_ocr     (event_id, ocr_status),

    -- For search result sorting by shot_at ASC (REQ-5.1.1)
    INDEX idx_photos_event_shot_at (event_id, shot_at)

) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;


-- ------------------------------------------------------------
-- 4. photo_bib_tags
--    Role: Photo-BibNumber mapping (OCR auto / manual input)
--    Denormalized: source column distinguishes OCR/manual (no separate table)
--    bib_number: SMALLINT UNSIGNED (0~65535, covers 2~5 digit bib numbers)
-- ------------------------------------------------------------
CREATE TABLE photo_bib_tags (
    id         CHAR(36)        NOT NULL DEFAULT (UUID()),
    photo_id   CHAR(36)        NOT NULL,
    bib_number SMALLINT UNSIGNED NOT NULL,  -- bib number (e.g., 1234)

    -- OCR confidence: 0.0~1.0. Manual input always 1.0
    confidence FLOAT           NOT NULL DEFAULT 0.0,

    -- ocr: Tesseract auto / manual: Organizer/Photographer manual input
    source     ENUM('ocr','manual') NOT NULL DEFAULT 'ocr',

    created_at DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY (id),

    CONSTRAINT fk_photo_bib_tags_photo
        FOREIGN KEY (photo_id) REFERENCES photos(id) ON DELETE CASCADE,

    -- Prevent duplicate bib number for same photo
    UNIQUE KEY uq_photo_bib (photo_id, bib_number),

    -- Core search index (REQ-5.1.1)
    INDEX idx_bib_search (bib_number, photo_id)

) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

---

## Column Summary (컬럼 설명)

### users

| Column | Type | Description |
|---|---|---|
| `id` | CHAR(36) | UUID PK |
| `email` | VARCHAR(255) | Login email (UNIQUE) |
| `password_hash` | VARCHAR(255) | bcrypt hash |
| `role` | ENUM | participant / photographer / organizer / admin |

### events

| Column | Type | Description |
|---|---|---|
| `id` | CHAR(36) | UUID PK |
| `organizer_id` | CHAR(36) | Creator users.id |
| `name` | VARCHAR(255) | Event name |
| `event_date` | DATE | Event date |
| `location` | VARCHAR(255) | Location |
| `description` | TEXT | Description (optional) |

### photos

| Column | Type | Description |
|---|---|---|
| `id` | CHAR(36) | UUID PK |
| `event_id` | CHAR(36) | Parent event |
| `uploader_id` | CHAR(36) | Uploader user |
| `storage_key` | VARCHAR(512) | MinIO original path |
| `thumbnail_key` | VARCHAR(512) | MinIO thumbnail path (nullable) |
| `original_filename` | VARCHAR(255) | Original filename |
| `file_size` | INT UNSIGNED | File size in bytes |
| `shot_at` | DATETIME | EXIF shot time (nullable) |
| `ocr_status` | ENUM | pending -> processing -> done / unrecognized |

### photo_bib_tags

| Column | Type | Description |
|---|---|---|
| `id` | CHAR(36) | UUID PK |
| `photo_id` | CHAR(36) | Related photo |
| `bib_number` | SMALLINT UNSIGNED | Bib number |
| `confidence` | FLOAT | OCR confidence (manual=1.0) |
| `source` | ENUM | ocr / manual |

---

## Key Queries (핵심 쿼리)

### Bib Number Search (REQ-5.1.1 / 배번호 검색)

```sql
-- photo_bib_tags driving, photos JOIN
-- Filter searchable photos with ocr_status = 'done'
SELECT
    p.id,
    p.storage_key,
    p.thumbnail_key,
    p.shot_at,
    t.bib_number,
    t.source AS tag_source
FROM photo_bib_tags t
JOIN photos p ON p.id = t.photo_id
WHERE t.bib_number  = :bib_number
  AND p.event_id    = :event_id
  AND p.ocr_status  = 'done'
ORDER BY COALESCE(p.shot_at, p.created_at) ASC;
--        shot_at fallback to created_at
```

### Manual Tag Insert (REQ-5.4.2 / 수동 태그 추가) - Transaction Required

```sql
-- MUST update ocr_status to 'done' together for search inclusion (BUG-01 fix)
START TRANSACTION;

INSERT IGNORE INTO photo_bib_tags (id, photo_id, bib_number, confidence, source)
VALUES (UUID(), :photo_id, :bib_number, 1.0, 'manual');

UPDATE photos
SET    ocr_status = 'done',
       updated_at = NOW()
WHERE  id = :photo_id
  AND  ocr_status = 'unrecognized';

COMMIT;
```

### Unrecognized Photo List (REQ-5.4.1 / 인식 실패 목록)

```sql
SELECT id, storage_key, thumbnail_key, original_filename, shot_at
FROM   photos
WHERE  event_id   = :event_id
  AND  ocr_status = 'unrecognized'
ORDER BY COALESCE(shot_at, created_at) ASC;
```

### Event Status Summary (REQ-2.3.1 / 이벤트 상태 요약)

```sql
SELECT
    COUNT(*)                                    AS total,
    SUM(ocr_status = 'done')                    AS done,
    SUM(ocr_status = 'unrecognized')            AS unrecognized,
    SUM(ocr_status IN ('pending','processing')) AS in_progress
FROM photos
WHERE event_id = :event_id;
```

---

## OCR Status Transition (OCR 상태 전이)

```
Upload Complete (업로드 완료)
    |
    v
[pending]  --> Worker consumes message
    |
    v
[processing]  --> Tesseract OCR
    |              |
    v              v
[done]      [unrecognized]
(tag saved)   (waiting for manual tag)
    ^                 |
    +-----------------+
       Manual tag input
       updates to 'done'
```

---

## Diff from Previous Version (이전 버전과의 차이)

| Item | ERD_Doc.md (v1.2) | This Document (MVP v1.0) |
|---|---|---|
| `refresh_tokens` | Included | **Excluded** (out of MVP scope) |
| `events.cover_image_key` | Existed in original | **Excluded** (text card UI) |
| `photos.thumbnail_key` | Missing | **Included** (worker generates) |
| `bib_number` type | `SMALLINT UNSIGNED` | Same |
| `shot_at` fallback | Not handled | `COALESCE(shot_at, created_at)` applied |
| Index count | 10 | **7** (query-based minimum) |
