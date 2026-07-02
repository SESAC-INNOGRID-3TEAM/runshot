from sqlalchemy.dialects.mysql import INTEGER

from ..extensions import db
from .base import created_at_col, updated_at_col, uuid_pk

OCR_STATUSES = ("pending", "processing", "done", "unrecognized")


class Photo(db.Model):
    __tablename__ = "photos"

    id = uuid_pk()
    event_id = db.Column(
        db.String(36), db.ForeignKey("events.id", ondelete="CASCADE"), nullable=False
    )
    uploader_id = db.Column(
        db.String(36), db.ForeignKey("users.id", ondelete="RESTRICT"), nullable=False
    )
    storage_key = db.Column(db.String(512), nullable=False, unique=True)
    thumbnail_key = db.Column(db.String(512), nullable=True)
    original_filename = db.Column(db.String(255), nullable=False, default="")
    file_size = db.Column(INTEGER(unsigned=True), nullable=False, default=0)
    shot_at = db.Column(db.DateTime, nullable=True)
    ocr_status = db.Column(
        db.Enum(*OCR_STATUSES, name="ocr_status"), nullable=False, default="pending"
    )
    created_at = created_at_col()
    updated_at = updated_at_col()

    bib_tags = db.relationship(
        "PhotoBibTag", backref="photo", cascade="all, delete-orphan", passive_deletes=True
    )

    __table_args__ = (
        db.Index("idx_photos_event_ocr", "event_id", "ocr_status"),
        db.Index("idx_photos_event_shot_at", "event_id", "shot_at"),
    )
