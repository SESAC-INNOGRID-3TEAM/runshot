"""인증 API: 회원가입 / 로그인 / 토큰 갱신 / 로그아웃 / 내 정보."""
import re

from flask import Blueprint, g, request

from ..extensions import db
from ..models import User
from ..models.user import ROLES
from ..schemas import user_schema
from ..services import auth as auth_svc
from ..utils import error, require_auth

auth_bp = Blueprint("auth", __name__, url_prefix="/api/auth")

EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
# 8자 이상, 영문자와 숫자를 모두 포함
PASSWORD_RE = re.compile(r"^(?=.*[A-Za-z])(?=.*\d).{8,}$")


def _tokens_response(user):
    return {
        "access_token": auth_svc.create_access_token(user),
        "refresh_token": auth_svc.issue_refresh_token(user),
        "user": user_schema.dump(user),
    }


@auth_bp.post("/signup")
def signup():
    data = request.get_json(silent=True) or {}
    email = (data.get("email") or "").strip().lower()
    password = data.get("password") or ""
    # 데모 편의상 signup에서 role 지정 허용(기본 participant).
    # 단 admin은 자가 가입 불가 — 기존 admin이 역할변경 API로만 승격(권한 탈취 방지).
    role = data.get("role") or "participant"

    if not EMAIL_RE.match(email):
        return error("이메일 형식이 올바르지 않습니다.")
    if not PASSWORD_RE.match(password):
        return error("비밀번호는 8자 이상이며 영문자와 숫자를 포함해야 합니다.")
    if role not in ROLES:
        return error("유효하지 않은 역할입니다.")
    if role == "admin":
        return error("admin 역할로는 가입할 수 없습니다.", 403)
    if User.query.filter_by(email=email).first():
        return error("이미 가입된 이메일입니다.", 409)

    user = User(email=email, password_hash=auth_svc.hash_password(password), role=role)
    db.session.add(user)
    db.session.commit()
    return _tokens_response(user), 201


@auth_bp.post("/login")
def login():
    data = request.get_json(silent=True) or {}
    email = (data.get("email") or "").strip().lower()
    password = data.get("password") or ""

    user = User.query.filter_by(email=email).first()
    if user is None or not auth_svc.verify_password(password, user.password_hash):
        return error("이메일 또는 비밀번호가 올바르지 않습니다.", 401)
    return _tokens_response(user)


@auth_bp.post("/refresh")
def refresh():
    data = request.get_json(silent=True) or {}
    raw = data.get("refresh_token") or ""
    user = auth_svc.consume_refresh_token(raw)
    if user is None:
        return error("유효하지 않거나 만료된 refresh token 입니다.", 401)
    return {"access_token": auth_svc.create_access_token(user)}


@auth_bp.post("/logout")
@require_auth
def logout():
    auth_svc.revoke_user_tokens(g.user.id)
    return {"message": "로그아웃되었습니다."}


@auth_bp.get("/me")
@require_auth
def me():
    return user_schema.dump(g.user)
