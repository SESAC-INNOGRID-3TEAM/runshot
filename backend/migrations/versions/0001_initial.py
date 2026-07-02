"""initial schema (users, events, photos, photo_bib_tags, refresh_tokens)

Revision ID: 0001_initial
Revises:
Create Date: 2026-07-02

DB Schema v2.0 (MVP) 기준. 수기 작성(로컬에 MySQL이 없어 autogenerate 불가).
"""
import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import mysql

revision = "0001_initial"
down_revision = None
branch_labels = None
depends_on = None

UUID_DEFAULT = sa.text("(UUID())")
TS = sa.text("CURRENT_TIMESTAMP")
TS_ON_UPDATE = sa.text("CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP")


def upgrade():
    op.create_table(
        "users",
        sa.Column("id", sa.CHAR(36), server_default=UUID_DEFAULT, nullable=False),
        sa.Column("email", sa.String(255), nullable=False),
        sa.Column("password_hash", sa.String(255), nullable=False),
        sa.Column(
            "role",
            mysql.ENUM("participant", "photographer", "organizer", "admin"),
            server_default="participant",
            nullable=False,
        ),
        sa.Column("created_at", sa.DateTime, server_default=TS, nullable=False),
        sa.Column("updated_at", sa.DateTime, server_default=TS_ON_UPDATE, nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("email", name="uq_users_email"),
        mysql_engine="InnoDB",
        mysql_charset="utf8mb4",
    )

    op.create_table(
        "events",
        sa.Column("id", sa.CHAR(36), server_default=UUID_DEFAULT, nullable=False),
        sa.Column("organizer_id", sa.CHAR(36), nullable=False),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("event_date", sa.Date, nullable=False),
        sa.Column("location", sa.String(255), server_default="", nullable=False),
        sa.Column("description", sa.Text, nullable=True),
        sa.Column("created_at", sa.DateTime, server_default=TS, nullable=False),
        sa.Column("updated_at", sa.DateTime, server_default=TS_ON_UPDATE, nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(
            ["organizer_id"], ["users.id"], name="fk_events_organizer", ondelete="RESTRICT"
        ),
        mysql_engine="InnoDB",
        mysql_charset="utf8mb4",
    )
    op.create_index("idx_events_created_at", "events", ["created_at"])

    op.create_table(
        "photos",
        sa.Column("id", sa.CHAR(36), server_default=UUID_DEFAULT, nullable=False),
        sa.Column("event_id", sa.CHAR(36), nullable=False),
        sa.Column("uploader_id", sa.CHAR(36), nullable=False),
        sa.Column("storage_key", sa.String(512), nullable=False),
        sa.Column("thumbnail_key", sa.String(512), nullable=True),
        sa.Column("original_filename", sa.String(255), server_default="", nullable=False),
        sa.Column("file_size", mysql.INTEGER(unsigned=True), server_default="0", nullable=False),
        sa.Column("shot_at", sa.DateTime, nullable=True),
        sa.Column(
            "ocr_status",
            mysql.ENUM("pending", "processing", "done", "unrecognized"),
            server_default="pending",
            nullable=False,
        ),
        sa.Column("created_at", sa.DateTime, server_default=TS, nullable=False),
        sa.Column("updated_at", sa.DateTime, server_default=TS_ON_UPDATE, nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(
            ["event_id"], ["events.id"], name="fk_photos_event", ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(
            ["uploader_id"], ["users.id"], name="fk_photos_uploader", ondelete="RESTRICT"
        ),
        sa.UniqueConstraint("storage_key", name="uq_photos_storage_key"),
        mysql_engine="InnoDB",
        mysql_charset="utf8mb4",
    )
    op.create_index("idx_photos_event_ocr", "photos", ["event_id", "ocr_status"])
    op.create_index("idx_photos_event_shot_at", "photos", ["event_id", "shot_at"])

    op.create_table(
        "photo_bib_tags",
        sa.Column("id", sa.CHAR(36), server_default=UUID_DEFAULT, nullable=False),
        sa.Column("photo_id", sa.CHAR(36), nullable=False),
        sa.Column("bib_number", mysql.SMALLINT(unsigned=True), nullable=False),
        sa.Column("confidence", sa.Float, server_default="0", nullable=False),
        sa.Column(
            "source", mysql.ENUM("ocr", "manual"), server_default="ocr", nullable=False
        ),
        sa.Column("created_at", sa.DateTime, server_default=TS, nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(
            ["photo_id"], ["photos.id"], name="fk_photo_bib_tags_photo", ondelete="CASCADE"
        ),
        sa.UniqueConstraint("photo_id", "bib_number", name="uq_photo_bib"),
        mysql_engine="InnoDB",
        mysql_charset="utf8mb4",
    )
    op.create_index("idx_bib_search", "photo_bib_tags", ["bib_number", "photo_id"])

    # refresh_tokens: 로그인 refresh token 해시 저장(로그아웃 시 삭제)
    op.create_table(
        "refresh_tokens",
        sa.Column("id", sa.CHAR(36), server_default=UUID_DEFAULT, nullable=False),
        sa.Column("user_id", sa.CHAR(36), nullable=False),
        sa.Column("token_hash", sa.String(64), nullable=False),
        sa.Column("expires_at", sa.DateTime, nullable=False),
        sa.Column("created_at", sa.DateTime, server_default=TS, nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(
            ["user_id"], ["users.id"], name="fk_refresh_user", ondelete="CASCADE"
        ),
        sa.UniqueConstraint("token_hash", name="uq_refresh_token_hash"),
        mysql_engine="InnoDB",
        mysql_charset="utf8mb4",
    )
    op.create_index("idx_refresh_user", "refresh_tokens", ["user_id"])


def downgrade():
    op.drop_table("refresh_tokens")
    op.drop_table("photo_bib_tags")
    op.drop_table("photos")
    op.drop_table("events")
    op.drop_table("users")
