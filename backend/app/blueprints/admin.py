"""관리자 API: 사용자 목록 / 역할 변경. (이벤트 삭제는 events 블루프린트)"""
from flask import Blueprint, request

from ..extensions import db
from ..models import User
from ..models.user import ROLES
from ..schemas import user_schema, users_schema
from ..utils import error, require_role

admin_bp = Blueprint("admin", __name__, url_prefix="/api/admin")


@admin_bp.get("/users")
@require_role("admin")
def list_users():
    users = User.query.order_by(User.created_at.desc()).all()
    return {"users": users_schema.dump(users)}


@admin_bp.patch("/users/<user_id>/role")
@require_role("admin")
def change_role(user_id):
    role = (request.get_json(silent=True) or {}).get("role")
    if role not in ROLES:
        return error("유효하지 않은 역할입니다.")

    user = db.session.get(User, user_id)
    if user is None:
        return error("사용자를 찾을 수 없습니다.", 404)

    user.role = role
    db.session.commit()
    return user_schema.dump(user)
