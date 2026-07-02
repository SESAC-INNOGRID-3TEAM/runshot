from sqlalchemy.dialects.mysql import SMALLINT

from ..extensions import db
from .base import created_at_col, uuid_pk


class PhotoBibTag(db.Model):
    __tablename__ = "photo_bib_tags"

    id = uuid_pk()
    photo_id = db.Column(
        db.String(36), db.ForeignKey("photos.id", ondelete="CASCADE"), nullable=False
    )
    bib_number = db.Column(SMALLINT(unsigned=True), nullable=False)
    confidence = db.Column(db.Float, nullable=False, default=0.0)
    source = db.Column(
        db.Enum("ocr", "manual", name="bib_source"), nullable=False, default="ocr"
    )
    created_at = created_at_col()

    __table_args__ = (
        db.UniqueConstraint("photo_id", "bib_number", name="uq_photo_bib"),
        db.Index("idx_bib_search", "bib_number", "photo_id"),
    )
