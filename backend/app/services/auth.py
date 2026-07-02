"""인증 서비스: bcrypt 해싱, JWT access token, opaque refresh token."""
import hashlib
import secrets
from datetime import datetime, timedelta, timezone

import bcrypt
import jwt
from flask import current_app

from ..extensions import db
from ..models import RefreshToken, User


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt(rounds=12)).decode()


def verify_password(password: str, password_hash: str) -> bool:
    return bcrypt.checkpw(password.encode(), password_hash.encode())


def create_access_token(user: User) -> str:
    now = datetime.now(timezone.utc)
    payload = {
        "sub": user.id,
        "role": user.role,
        "iat": now,
        "exp": now + timedelta(minutes=current_app.config["JWT_ACCESS_EXPIRE_MINUTES"]),
    }
    return jwt.encode(payload, current_app.config["SECRET_KEY"], algorithm="HS256")


def decode_access_token(token: str) -> dict:
    """유효하면 payload, 아니면 jwt 예외 발생."""
    return jwt.decode(token, current_app.config["SECRET_KEY"], algorithms=["HS256"])


def _hash_token(raw: str) -> str:
    return hashlib.sha256(raw.encode()).hexdigest()


def issue_refresh_token(user: User) -> str:
    """opaque refresh token 생성, 해시를 DB에 저장, 원문 반환."""
    raw = secrets.token_urlsafe(48)
    expires = datetime.now(timezone.utc) + timedelta(
        days=current_app.config["JWT_REFRESH_EXPIRE_DAYS"]
    )
    db.session.add(
        RefreshToken(user_id=user.id, token_hash=_hash_token(raw), expires_at=expires)
    )
    db.session.commit()
    return raw


def consume_refresh_token(raw: str) -> User | None:
    """refresh token 검증. 유효하면 해당 User 반환, 아니면 None. 만료분은 정리."""
    row = RefreshToken.query.filter_by(token_hash=_hash_token(raw)).first()
    if row is None:
        return None
    if row.expires_at.replace(tzinfo=timezone.utc) < datetime.now(timezone.utc):
        db.session.delete(row)
        db.session.commit()
        return None
    return db.session.get(User, row.user_id)


def revoke_user_tokens(user_id: str) -> int:
    """로그아웃: 해당 유저의 모든 refresh token 삭제."""
    count = RefreshToken.query.filter_by(user_id=user_id).delete()
    db.session.commit()
    return count
