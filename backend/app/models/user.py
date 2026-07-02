from ..extensions import db
from .base import created_at_col, updated_at_col, uuid_pk

ROLES = ("participant", "photographer", "organizer", "admin")
ROLE_RANK = {r: i for i, r in enumerate(ROLES)}  # participant<photographer<organizer<admin


class User(db.Model):
    __tablename__ = "users"

    id = uuid_pk()
    email = db.Column(db.String(255), nullable=False, unique=True)
    password_hash = db.Column(db.String(255), nullable=False)
    role = db.Column(db.Enum(*ROLES, name="user_role"), nullable=False, default="participant")
    created_at = created_at_col()
    updated_at = updated_at_col()

    def has_role(self, minimum):
        return ROLE_RANK[self.role] >= ROLE_RANK[minimum]

    @property
    def is_admin(self):
        return self.role == "admin"
