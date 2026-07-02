"""Flask 앱 팩토리."""
from flask import Flask, jsonify
from flask_cors import CORS
from marshmallow import ValidationError
from werkzeug.exceptions import HTTPException

from .config import Config
from .extensions import db, init_redis, migrate


def create_app(config_object=Config):
    app = Flask(__name__)
    app.config.from_object(config_object)

    db.init_app(app)
    migrate.init_app(app, db)
    init_redis(app)
    CORS(app, resources={r"/api/*": {"origins": app.config["CORS_ORIGINS"]}})

    # 모델 등록(마이그레이션 인식용)
    from . import models  # noqa: F401

    from .blueprints.admin import admin_bp
    from .blueprints.auth import auth_bp
    from .blueprints.events import events_bp
    from .blueprints.photos import photos_bp

    for bp in (auth_bp, events_bp, photos_bp, admin_bp):
        app.register_blueprint(bp)

    _register_error_handlers(app)

    @app.get("/api/health")
    def health():
        return {"status": "ok"}

    return app


def _register_error_handlers(app):
    @app.errorhandler(ValidationError)
    def _validation(err):
        # Marshmallow 검증 실패 → 첫 메시지를 error로
        messages = err.messages
        first = next(iter(messages.values())) if isinstance(messages, dict) else messages
        msg = first[0] if isinstance(first, list) else str(first)
        return jsonify({"error": msg}), 400

    @app.errorhandler(HTTPException)
    def _http(err):
        return jsonify({"error": err.description}), err.code

    @app.errorhandler(Exception)
    def _unhandled(err):
        app.logger.exception("unhandled error")
        return jsonify({"error": "internal server error"}), 500
