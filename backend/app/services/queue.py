"""RabbitMQ 퍼블리셔. AWS SQS 교체 시 이 파일만 교체(인터페이스 유지).

MVP는 발행 시마다 블로킹 커넥션을 열고 닫는다. 요청량이 적은 데모 환경에 충분.
ponytail: connect-per-publish, 처리량 늘면 채널 풀/영속 커넥션으로 교체.
"""
import json

import pika
from flask import current_app

# ocr_queue TTL 24시간 (SYSTEM_ARCHITECTURE §9). 워커의 queue_declare 인자와 일치해야
# PRECONDITION_FAILED 없이 선언된다.
_OCR_QUEUE_TTL_MS = 24 * 60 * 60 * 1000


def _connect():
    params = pika.ConnectionParameters(
        host=current_app.config["RABBITMQ_HOST"],
        port=current_app.config["RABBITMQ_PORT"],
        credentials=pika.PlainCredentials(
            current_app.config["RABBITMQ_USER"], current_app.config["RABBITMQ_PASSWORD"]
        ),
        heartbeat=600,
        connection_attempts=3,
        retry_delay=5,
    )
    return pika.BlockingConnection(params)


def publish_ocr_job(message: dict):
    """ocr_queue에 OCR 작업 메시지 발행. durable 큐, persistent 메시지."""
    queue = current_app.config["RABBITMQ_OCR_QUEUE"]
    conn = _connect()
    try:
        channel = conn.channel()
        channel.queue_declare(
            queue=queue, durable=True, arguments={"x-message-ttl": _OCR_QUEUE_TTL_MS}
        )
        channel.basic_publish(
            exchange="",
            routing_key=queue,
            body=json.dumps(message),
            properties=pika.BasicProperties(
                delivery_mode=2, content_type="application/json"
            ),
        )
    finally:
        conn.close()
