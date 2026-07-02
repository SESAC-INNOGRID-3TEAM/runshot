"""이벤트 API: 생성 / 목록 / 상세(+상태요약) / 수정 / 삭제."""
from flask import Blueprint, g, request
from sqlalchemy import case, func

from ..extensions import db
from ..models import Event, Photo
from ..schemas import event_input_schema, event_schema, events_schema
from ..utils import error, require_role

events_bp = Blueprint("events", __name__, url_prefix="/api/events")


def _status_summary(event_id):
    """photos.ocr_status 집계 → total/done/unrecognized/in_progress."""
    row = (
        db.session.query(
            func.count(Photo.id),
            func.sum(case((Photo.ocr_status == "done", 1), else_=0)),
            func.sum(case((Photo.ocr_status == "unrecognized", 1), else_=0)),
            func.sum(case((Photo.ocr_status.in_(("pending", "processing")), 1), else_=0)),
        )
        .filter(Photo.event_id == event_id)
        .one()
    )
    total, done, unrecognized, in_progress = row
    return {
        "total": total or 0,
        "done": int(done or 0),
        "unrecognized": int(unrecognized or 0),
        "in_progress": int(in_progress or 0),
    }


@events_bp.get("")
def list_events():
    events = Event.query.order_by(Event.created_at.desc()).all()
    return {"events": events_schema.dump(events)}


@events_bp.get("/<event_id>")
def get_event(event_id):
    event = db.session.get(Event, event_id)
    if event is None:
        return error("이벤트를 찾을 수 없습니다.", 404)
    return {**event_schema.dump(event), "summary": _status_summary(event_id)}


@events_bp.post("")
@require_role("organizer")
def create_event():
    data = event_input_schema.load(request.get_json(silent=True) or {})
    event = Event(organizer_id=g.user.id, **data)
    db.session.add(event)
    db.session.commit()
    return event_schema.dump(event), 201


@events_bp.put("/<event_id>")
@require_role("organizer")
def update_event(event_id):
    event = db.session.get(Event, event_id)
    if event is None:
        return error("이벤트를 찾을 수 없습니다.", 404)
    if event.organizer_id != g.user.id and not g.user.is_admin:
        return error("본인이 만든 이벤트만 수정할 수 있습니다.", 403)

    data = event_input_schema.load(request.get_json(silent=True) or {}, partial=True)
    for key, value in data.items():
        setattr(event, key, value)
    db.session.commit()
    return event_schema.dump(event)


@events_bp.delete("/<event_id>")
@require_role("admin")
def delete_event(event_id):
    event = db.session.get(Event, event_id)
    if event is None:
        return error("이벤트를 찾을 수 없습니다.", 404)
    db.session.delete(event)  # photos/photo_bib_tags는 CASCADE로 삭제
    db.session.commit()
    return {"message": "이벤트가 삭제되었습니다."}
