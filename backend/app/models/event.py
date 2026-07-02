from ..extensions import db
from .base import created_at_col, updated_at_col, uuid_pk


class Event(db.Model):
    __tablename__ = "events"

    id = uuid_pk()
    organizer_id = db.Column(
        db.String(36), db.ForeignKey("users.id", ondelete="RESTRICT"), nullable=False
    )
    name = db.Column(db.String(255), nullable=False)
    event_date = db.Column(db.Date, nullable=False)
    location = db.Column(db.String(255), nullable=False, default="")
    description = db.Column(db.Text, nullable=True)
    created_at = created_at_col()
    updated_at = updated_at_col()

    __table_args__ = (db.Index("idx_events_created_at", "created_at"),)
