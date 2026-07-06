"""환경변수 기반 설정. python-dotenv로 .env 로드."""
import os

from dotenv import load_dotenv

load_dotenv()


def _int(name, default):
    return int(os.getenv(name, default))


class Config:
    APP_ENV = os.getenv("APP_ENV", "local")
    SECRET_KEY = os.getenv("SECRET_KEY", "dev-secret-change-me")

    # ----- MySQL -----
    DB_HOST = os.getenv("DB_HOST", "localhost")
    DB_PORT = _int("DB_PORT", 3306)
    DB_NAME = os.getenv("DB_NAME", "runshot")
    DB_USER = os.getenv("DB_USER", "runshot")
    DB_PASSWORD = os.getenv("DB_PASSWORD", "runshot_password")

    SQLALCHEMY_DATABASE_URI = (
        f"mysql+pymysql://{DB_USER}:{DB_PASSWORD}@{DB_HOST}:{DB_PORT}/{DB_NAME}"
        "?charset=utf8mb4"
    )
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    SQLALCHEMY_ENGINE_OPTIONS = {"pool_pre_ping": True, "pool_recycle": 280}

    # ----- Redis (검색 캐시) -----
    REDIS_HOST = os.getenv("REDIS_HOST", "localhost")
    REDIS_PORT = _int("REDIS_PORT", 6379)
    SEARCH_CACHE_TTL = _int("SEARCH_CACHE_TTL", 600)  # 10분

    # ----- MinIO -----
    MINIO_ENDPOINT = os.getenv("MINIO_ENDPOINT", "localhost:9000")
    MINIO_ACCESS_KEY = os.getenv("MINIO_ACCESS_KEY", "minioadmin")
    MINIO_SECRET_KEY = os.getenv("MINIO_SECRET_KEY", "minioadmin")
    MINIO_SECURE = os.getenv("MINIO_SECURE", "false").lower() == "true"
    MINIO_REGION = os.getenv("MINIO_REGION", "us-east-1")
    MINIO_BUCKET_RAW = os.getenv("MINIO_BUCKET_RAW", "runshot-raw")
    MINIO_BUCKET_DERIVED = os.getenv("MINIO_BUCKET_DERIVED", "runshot-derived")
    MINIO_BUCKET_COVERS = os.getenv("MINIO_BUCKET_COVERS", "runshot-covers")
    PRESIGNED_PUT_EXPIRY = _int("MINIO_PRESIGNED_EXPIRY", 900)  # 15분
    PRESIGNED_GET_EXPIRY = _int("MINIO_PRESIGNED_GET_EXPIRY", 3600)  # 1시간

    # ----- RabbitMQ -----
    RABBITMQ_HOST = os.getenv("RABBITMQ_HOST", "localhost")
    RABBITMQ_PORT = _int("RABBITMQ_PORT", 5672)
    RABBITMQ_USER = os.getenv("RABBITMQ_USER", "runshot")
    RABBITMQ_PASSWORD = os.getenv("RABBITMQ_PASSWORD", "runshot_password")
    RABBITMQ_OCR_QUEUE = os.getenv("RABBITMQ_OCR_QUEUE", "ocr_queue")

    # ----- JWT -----
    JWT_ACCESS_EXPIRE_MINUTES = _int("JWT_ACCESS_EXPIRE_MINUTES", 1440)  # 24h (MVP)
    JWT_REFRESH_EXPIRE_DAYS = _int("JWT_REFRESH_EXPIRE_DAYS", 7)

    # ----- 업로드 제한 -----
    UPLOAD_MAX_FILES = 200
    UPLOAD_MAX_SIZE = 20 * 1024 * 1024  # 20MB
    ALLOWED_CONTENT_TYPES = {"image/jpeg", "image/png", "image/webp"}

    # ----- CORS -----
    CORS_ORIGINS = os.getenv("CORS_ORIGINS", "*")
