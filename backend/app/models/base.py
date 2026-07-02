"""모델 공용 헬퍼 (UUID PK, 타임스탬프)."""
import uuid

from sqlalchemy import func

from ..extensions import db


def uuid_pk():
    return db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))


def created_at_col():
    return db.Column(db.DateTime, nullable=False, server_default=func.now())


def updated_at_col():
    return db.Column(
        db.DateTime,
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )
