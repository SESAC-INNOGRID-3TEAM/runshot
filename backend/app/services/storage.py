"""MinIO 추상화 레이어. AWS S3 교체 시 이 파일만 바꾸면 됨(인터페이스 유지)."""
from datetime import timedelta

from flask import current_app
from minio import Minio

_client = None


def _get_client() -> Minio:
    global _client
    if _client is None:
        _client = Minio(
            current_app.config["MINIO_ENDPOINT"],
            access_key=current_app.config["MINIO_ACCESS_KEY"],
            secret_key=current_app.config["MINIO_SECRET_KEY"],
            secure=current_app.config["MINIO_SECURE"],
        )
    return _client


def ensure_buckets():
    """raw / derived 버킷이 없으면 생성. 앱 부팅 시 1회 호출용(선택)."""
    client = _get_client()
    for bucket in (
        current_app.config["MINIO_BUCKET_RAW"],
        current_app.config["MINIO_BUCKET_DERIVED"],
    ):
        if not client.bucket_exists(bucket):
            client.make_bucket(bucket)


def presigned_put(storage_key: str, content_type: str = None) -> str:
    """업로드용 presigned PUT URL (raw 버킷). content_type은 클라가 PUT 시 동일 헤더 사용."""
    expiry = timedelta(seconds=current_app.config["PRESIGNED_PUT_EXPIRY"])
    return _get_client().presigned_put_object(
        current_app.config["MINIO_BUCKET_RAW"], storage_key, expires=expiry
    )


def presigned_get_raw(storage_key: str) -> str:
    return _presigned_get(current_app.config["MINIO_BUCKET_RAW"], storage_key)


def presigned_get_derived(storage_key: str) -> str:
    return _presigned_get(current_app.config["MINIO_BUCKET_DERIVED"], storage_key)


def _presigned_get(bucket: str, storage_key: str) -> str:
    expiry = timedelta(seconds=current_app.config["PRESIGNED_GET_EXPIRY"])
    return _get_client().presigned_get_object(bucket, storage_key, expires=expiry)
