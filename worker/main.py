import io
import json
import logging
import os

import pika
from dotenv import load_dotenv
from minio import Minio
from PIL import Image

load_dotenv()

from db import Photo, PhotoBibTag, get_session
from ocr import extract_bib_number
from thumbnail import create_and_upload_thumbnail

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger("worker")

_minio_client = None


def _get_minio_client() -> Minio:
    global _minio_client
    if _minio_client is None:
        _minio_client = Minio(
            os.environ["MINIO_ENDPOINT"],
            access_key=os.environ["MINIO_ACCESS_KEY"],
            secret_key=os.environ["MINIO_SECRET_KEY"],
            secure=False,
        )
    return _minio_client


def _download_image(storage_key: str) -> Image.Image:
    response = _get_minio_client().get_object(os.environ["MINIO_BUCKET_RAW"], storage_key)
    try:
        return Image.open(io.BytesIO(response.read()))
    finally:
        response.close()
        response.release_conn()


def _mark_status(photo_id: str, status: str, thumbnail_key: str | None = None) -> None:
    with get_session() as db:
        photo = db.get(Photo, photo_id)
        if photo is None:
            logger.warning(json.dumps({"event": "photo_not_found", "photo_id": photo_id}))
            return
        photo.ocr_status = status
        if thumbnail_key is not None:
            photo.thumbnail_key = thumbnail_key


def _save_bib_tag(photo_id: str, bib_number: int, confidence: float) -> None:
    with get_session() as db:
        db.add(
            PhotoBibTag(
                photo_id=photo_id, bib_number=bib_number, confidence=confidence, source="ocr"
            )
        )


def process_message(payload: dict) -> None:
    photo_id = payload["photo_id"]
    storage_key = payload["storage_key"]

    logger.info(json.dumps({"event": "processing_start", "photo_id": photo_id}))
    _mark_status(photo_id, "processing")

    try:
        image = _download_image(storage_key)
        candidate = extract_bib_number(image)
        thumbnail_key = create_and_upload_thumbnail(image, storage_key)

        if candidate is not None:
            _save_bib_tag(photo_id, candidate["bib_number"], candidate["confidence"])
            _mark_status(photo_id, "done", thumbnail_key)
            logger.info(
                json.dumps(
                    {
                        "event": "processing_done",
                        "photo_id": photo_id,
                        "bib_number": candidate["bib_number"],
                    }
                )
            )
        else:
            _mark_status(photo_id, "unrecognized", thumbnail_key)
            logger.info(json.dumps({"event": "processing_unrecognized", "photo_id": photo_id}))
    except Exception:
        logger.exception(json.dumps({"event": "processing_failed", "photo_id": photo_id}))
        _mark_status(photo_id, "unrecognized")


def _on_message(channel, method, _properties, body):
    try:
        process_message(json.loads(body))
    except Exception:
        logger.exception(json.dumps({"event": "message_handling_failed"}))
    finally:
        channel.basic_ack(delivery_tag=method.delivery_tag)


def main() -> None:
    queue_name = os.environ.get("RABBITMQ_OCR_QUEUE", "ocr_queue")
    credentials = pika.PlainCredentials(
        os.environ["RABBITMQ_USER"], os.environ["RABBITMQ_PASSWORD"]
    )
    parameters = pika.ConnectionParameters(
        host=os.environ["RABBITMQ_HOST"],
        port=int(os.environ.get("RABBITMQ_PORT", 5672)),
        credentials=credentials,
    )

    connection = pika.BlockingConnection(parameters)
    channel = connection.channel()
    channel.queue_declare(queue=queue_name, durable=True)
    channel.basic_qos(prefetch_count=1)
    channel.basic_consume(queue=queue_name, on_message_callback=_on_message)

    logger.info(json.dumps({"event": "worker_started", "queue": queue_name}))
    channel.start_consuming()


if __name__ == "__main__":
    main()
