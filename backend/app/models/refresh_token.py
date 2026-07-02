from ..extensions import db
from .base import created_at_col, uuid_pk


class RefreshToken(db.Model):
    """로그인 시 발급한 opaque refresh token의 해시 저장. 로그아웃 시 삭제(revoke)."""

    __tablename__ = "refresh_tokens"

    id = uuid_pk()
    user_id = db.Column(
        db.String(36), db.ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    token_hash = db.Column(db.String(64), nullable=False, unique=True)  # sha256 hex
    expires_at = db.Column(db.DateTime, nullable=False)
    created_at = created_at_col()

    __table_args__ = (db.Index("idx_refresh_user", "user_id"),)
