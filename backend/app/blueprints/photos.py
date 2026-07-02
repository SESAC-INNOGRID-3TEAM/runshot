"""사진 API: presigned 업로드 / 업로드 완료 / 배번호 검색 / 인식실패 목록 / 수동 태그."""
import json
import uuid
from datetime import datetime, timezone

from flask import Blueprint, current_app, g, request
from sqlalchemy import func

from ..extensions import db, redis_client
from ..models import Event, Photo, PhotoBibTag
from ..schemas import photo_schema
from ..services import storage
from ..services.queue import publish_ocr_job
from ..utils import error, require_role

photos_bp = Blueprint("photos", __name__, url_prefix="/api/events")

_EXT_BY_TYPE = {"image/jpeg": "jpg", "image/png": "png", "image/webp": "webp"}


def _require_event(event_id):
    return db.session.get(Event, event_id)


def _parse_bib(raw):
    """1~99999 정수만 허용. 실패 시 None."""
    if raw is None or not str(raw).isdigit():
        return None
    value = int(raw)
    return value if 1 <= value <= 99999 else None


# ---------------------------------------------------------------- 업로드
@photos_bp.post("/<event_id>/upload/presigned")
@require_role("photographer")
def presigned(event_id):
    if _require_event(event_id) is None:
        return error("이벤트를 찾을 수 없습니다.", 404)

    files = (request.get_json(silent=True) or {}).get("files")
    if not isinstance(files, list) or not files:
        return error("files 목록이 필요합니다.")
    if len(files) > current_app.config["UPLOAD_MAX_FILES"]:
        return error(f"한 번에 최대 {current_app.config['UPLOAD_MAX_FILES']}개까지 업로드할 수 있습니다.")

    results = []
    for f in files:
        content_type = f.get("content_type")
        file_size = f.get("file_size", 0)
        if content_type not in current_app.config["ALLOWED_CONTENT_TYPES"]:
            return error("JPEG/PNG/WEBP 이미지만 업로드할 수 있습니다.")
        if not isinstance(file_size, int) or file_size <= 0 or file_size > current_app.config["UPLOAD_MAX_SIZE"]:
            return error("파일당 최대 20MB까지 업로드할 수 있습니다.")

        ext = _EXT_BY_TYPE[content_type]
        storage_key = f"events/{event_id}/{uuid.uuid4()}.{ext}"
        results.append(
            {
                "presigned_url": storage.presigned_put(storage_key, content_type),
                "storage_key": storage_key,
            }
        )
    return {"files": results}


@photos_bp.post("/<event_id>/upload/complete")
@require_role("photographer")
def complete(event_id):
    if _require_event(event_id) is None:
        return error("이벤트를 찾을 수 없습니다.", 404)

    files = (request.get_json(silent=True) or {}).get("files")
    if not isinstance(files, list) or not files:
        return error("files 목록이 필요합니다.")

    photo_ids = []
    for f in files:
        storage_key = f.get("storage_key")
        if not storage_key:
            continue
        photo = Photo(
            event_id=event_id,
            uploader_id=g.user.id,
            storage_key=storage_key,
            original_filename=f.get("filename", ""),
            file_size=f.get("file_size", 0),
            ocr_status="pending",
        )
        db.session.add(photo)
        photo_ids.append(photo.id)
    db.session.commit()

    # OCR 작업 발행. RabbitMQ 장애 시에도 업로드 자체는 성공 처리(사진은 pending 유지).
    for pid, f in zip(photo_ids, files):
        try:
            publish_ocr_job(
                {
                    "photo_id": pid,
                    "storage_key": f.get("storage_key"),
                    "event_id": event_id,
                    "retry_count": 0,
                    "enqueued_at": datetime.now(timezone.utc).isoformat(),
                }
            )
        except Exception:
            current_app.logger.exception("OCR 작업 발행 실패 photo_id=%s", pid)

    return {"processed": len(photo_ids), "photo_ids": photo_ids}


# ---------------------------------------------------------------- 검색
@photos_bp.get("/<event_id>/photos/search")
def search(event_id):
    bib = _parse_bib(request.args.get("bib"))
    if bib is None:
        return error("bib은 1~99999 사이의 숫자여야 합니다.")

    rows = _search_rows(event_id, bib)  # 캐시 or DB
    photos = [
        {
            "photo_id": r["photo_id"],
            "thumbnail_url": (
                storage.presigned_get_derived(r["thumbnail_key"])
                if r["thumbnail_key"]
                else storage.presigned_get_raw(r["storage_key"])
            ),
            "original_url": storage.presigned_get_raw(r["storage_key"]),
            "shot_at": r["shot_at"],
            "confidence": r["confidence"],
        }
        for r in rows
    ]
    return {
        "bib_number": str(bib),
        "event_id": event_id,
        "total": len(photos),
        "photos": photos,
    }


def _search_rows(event_id, bib):
    """검색 메타데이터(URL 제외) 목록. Redis 캐시 우선, 없으면 DB 조회 후 캐시."""
    key = f"search:{event_id}:{bib}"
    try:
        cached = redis_client.get(key)
        if cached is not None:
            return json.loads(cached)
    except Exception:
        current_app.logger.warning("검색 캐시 조회 실패 (Redis)", exc_info=True)

    q = (
        db.session.query(
            Photo.id,
            Photo.storage_key,
            Photo.thumbnail_key,
            Photo.shot_at,
            PhotoBibTag.confidence,
        )
        .join(PhotoBibTag, PhotoBibTag.photo_id == Photo.id)
        .filter(
            Photo.event_id == event_id,
            PhotoBibTag.bib_number == bib,
            Photo.ocr_status == "done",
        )
        .order_by(func.coalesce(Photo.shot_at, Photo.created_at).asc())
    )
    rows = [
        {
            "photo_id": pid,
            "storage_key": sk,
            "thumbnail_key": tk,
            "shot_at": shot_at.isoformat() if shot_at else None,
            "confidence": conf,
        }
        for pid, sk, tk, shot_at, conf in q.all()
    ]
    try:
        redis_client.setex(key, current_app.config["SEARCH_CACHE_TTL"], json.dumps(rows))
    except Exception:
        current_app.logger.warning("검색 캐시 저장 실패 (Redis)", exc_info=True)
    return rows


# ---------------------------------------------------------------- 인식 실패 목록
@photos_bp.get("/<event_id>/photos/unrecognized")
@require_role("photographer")
def unrecognized(event_id):
    if _require_event(event_id) is None:
        return error("이벤트를 찾을 수 없습니다.", 404)

    photos = (
        Photo.query.filter_by(event_id=event_id, ocr_status="unrecognized")
        .order_by(func.coalesce(Photo.shot_at, Photo.created_at).asc())
        .all()
    )
    return {
        "photos": [
            {
                **photo_schema.dump(p),
                "thumbnail_url": (
                    storage.presigned_get_derived(p.thumbnail_key)
                    if p.thumbnail_key
                    else storage.presigned_get_raw(p.storage_key)
                ),
                "original_url": storage.presigned_get_raw(p.storage_key),
            }
            for p in photos
        ]
    }


# ---------------------------------------------------------------- 수동 태그
@photos_bp.post("/<event_id>/photos/<photo_id>/tags")
@require_role("photographer")
def add_manual_tag(event_id, photo_id):
    bib = _parse_bib((request.get_json(silent=True) or {}).get("bib_number"))
    if bib is None:
        return error("bib_number는 1~99999 사이의 숫자여야 합니다.")

    photo = db.session.get(Photo, photo_id)
    if photo is None or photo.event_id != event_id:
        return error("사진을 찾을 수 없습니다.", 404)

    # BUG-01: 태그 INSERT와 ocr_status='done' UPDATE를 한 트랜잭션으로 함께 커밋.
    exists = PhotoBibTag.query.filter_by(photo_id=photo_id, bib_number=bib).first()
    if exists is None:
        db.session.add(
            PhotoBibTag(photo_id=photo_id, bib_number=bib, confidence=1.0, source="manual")
        )
    photo.ocr_status = "done"
    db.session.commit()

    # 해당 배번호 검색 캐시 무효화(있으면).
    try:
        redis_client.delete(f"search:{event_id}:{bib}")
    except Exception:
        pass

    return {"photo_id": photo_id, "bib_number": bib, "ocr_status": "done"}, 201
