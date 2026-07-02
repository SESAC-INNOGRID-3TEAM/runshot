"""공통 에러 헬퍼 + 인증/권한 데코레이터."""
from functools import wraps

import jwt
from flask import g, jsonify, request

from ..extensions import db
from ..models import User
from ..services.auth import decode_access_token


def error(message: str, status: int = 400):
    return jsonify({"error": message}), status


def require_auth(fn):
    """Authorization: Bearer <access token> 검증. 성공 시 g.user 세팅."""

    @wraps(fn)
    def wrapper(*args, **kwargs):
        header = request.headers.get("Authorization", "")
        if not header.startswith("Bearer "):
            return error("인증 토큰이 필요합니다.", 401)
        token = header[7:]
        try:
            payload = decode_access_token(token)
        except jwt.ExpiredSignatureError:
            return error("토큰이 만료되었습니다.", 401)
        except jwt.InvalidTokenError:
            return error("유효하지 않은 토큰입니다.", 401)

        user = db.session.get(User, payload.get("sub"))
        if user is None:
            return error("존재하지 않는 사용자입니다.", 401)
        g.user = user
        return fn(*args, **kwargs)

    return wrapper


def require_role(minimum: str):
    """최소 역할 이상만 허용. 위계: participant<photographer<organizer<admin."""

    def decorator(fn):
        @wraps(fn)
        @require_auth
        def wrapper(*args, **kwargs):
            if not g.user.has_role(minimum):
                return error("권한이 없습니다.", 403)
            return fn(*args, **kwargs)

        return wrapper

    return decorator
