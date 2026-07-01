import os
import uuid
from contextlib import contextmanager
from datetime import datetime

from dotenv import load_dotenv
from sqlalchemy import DateTime, Enum, Float, ForeignKey, SmallInteger, String, create_engine
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, sessionmaker

load_dotenv()


class Base(DeclarativeBase):
    pass


def _new_uuid() -> str:
    return str(uuid.uuid4())


# backend/app/models/photo.py 의 photos 테이블을 얇게 재정의 (워커가 쓰는 컬럼만)
class Photo(Base):
    __tablename__ = "photos"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    event_id: Mapped[str] = mapped_column(String(36))
    storage_key: Mapped[str] = mapped_column(String(512))
    thumbnail_key: Mapped[str | None] = mapped_column(String(512), nullable=True)
    ocr_status: Mapped[str] = mapped_column(
        Enum("pending", "processing", "done", "unrecognized", name="ocr_status")
    )
    updated_at: Mapped[datetime] = mapped_column(DateTime)


# backend/app/models/photo_bib_tag.py 의 photo_bib_tags 테이블을 얇게 재정의
class PhotoBibTag(Base):
    __tablename__ = "photo_bib_tags"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_new_uuid)
    photo_id: Mapped[str] = mapped_column(String(36), ForeignKey("photos.id"))
    bib_number: Mapped[int] = mapped_column(SmallInteger)
    confidence: Mapped[float] = mapped_column(Float, default=0.0)
    source: Mapped[str] = mapped_column(Enum("ocr", "manual", name="tag_source"), default="ocr")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


def _database_url() -> str:
    user = os.environ["DB_USER"]
    password = os.environ["DB_PASSWORD"]
    host = os.environ["DB_HOST"]
    port = os.environ.get("DB_PORT", "3306")
    name = os.environ["DB_NAME"]
    return f"mysql+pymysql://{user}:{password}@{host}:{port}/{name}"


engine = create_engine(_database_url(), pool_pre_ping=True)
SessionLocal = sessionmaker(bind=engine)


@contextmanager
def get_session():
    session = SessionLocal()
    try:
        yield session
        session.commit()
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()
