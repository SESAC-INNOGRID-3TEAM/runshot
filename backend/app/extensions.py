"""공유 확장 인스턴스. create_app()에서 init_app으로 바인딩."""
import redis
from flask_migrate import Migrate
from flask_sqlalchemy import SQLAlchemy

db = SQLAlchemy()
migrate = Migrate()

# 검색 캐시용 Redis. create_app에서 실제 연결 정보로 재바인딩(연결은 lazy).
redis_client = redis.Redis()


def init_redis(app):
    global redis_client
    redis_client = redis.Redis(
        host=app.config["REDIS_HOST"],
        port=app.config["REDIS_PORT"],
        decode_responses=True,
    )
