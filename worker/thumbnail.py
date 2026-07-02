import io
import os

from minio import Minio
from PIL import Image

_THUMBNAIL_MAX_WIDTH = 720

_client = None


def _get_client() -> Minio:
    global _client
    if _client is None:
        _client = Minio(
            os.environ["MINIO_ENDPOINT"],
            access_key=os.environ["MINIO_ACCESS_KEY"],
            secret_key=os.environ["MINIO_SECRET_KEY"],
            secure=False,
        )
    return _client


def _resize(image: Image.Image) -> Image.Image:
    if image.width <= _THUMBNAIL_MAX_WIDTH:
        return image
    ratio = _THUMBNAIL_MAX_WIDTH / image.width
    new_size = (_THUMBNAIL_MAX_WIDTH, int(image.height * ratio))
    return image.resize(new_size, Image.LANCZOS)


def _thumbnail_key(storage_key: str) -> str:
    base, _ext = os.path.splitext(storage_key)
    return f"{base}_thumb.jpg"


def create_and_upload_thumbnail(image: Image.Image, storage_key: str) -> str:
    thumbnail = _resize(image)
    if thumbnail.mode != "RGB":
        thumbnail = thumbnail.convert("RGB")

    buffer = io.BytesIO()
    thumbnail.save(buffer, format="JPEG", quality=85)
    buffer.seek(0)

    thumbnail_key = _thumbnail_key(storage_key)
    _get_client().put_object(
        os.environ["MINIO_BUCKET_DERIVED"],
        thumbnail_key,
        buffer,
        length=buffer.getbuffer().nbytes,
        content_type="image/jpeg",
    )
    return thumbnail_key
