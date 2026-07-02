"""Marshmallow 스키마 — 출력 직렬화 + 이벤트 입력 검증."""
from marshmallow import Schema, fields, validate


class UserSchema(Schema):
    id = fields.Str()
    email = fields.Email()
    role = fields.Str()
    created_at = fields.DateTime()
    updated_at = fields.DateTime()


class EventSchema(Schema):
    id = fields.Str()
    organizer_id = fields.Str()
    name = fields.Str()
    event_date = fields.Date()
    location = fields.Str()
    description = fields.Str(allow_none=True)
    created_at = fields.DateTime()
    updated_at = fields.DateTime()


class EventInputSchema(Schema):
    """이벤트 생성/수정 입력. 수정은 partial=True로 사용."""

    name = fields.Str(required=True, validate=validate.Length(min=1, max=255))
    event_date = fields.Date(required=True)
    location = fields.Str(load_default="", validate=validate.Length(max=255))
    description = fields.Str(load_default=None, allow_none=True)


class PhotoBibTagSchema(Schema):
    id = fields.Str()
    bib_number = fields.Int()
    confidence = fields.Float()
    source = fields.Str()


class PhotoSchema(Schema):
    id = fields.Str()
    event_id = fields.Str()
    storage_key = fields.Str()
    thumbnail_key = fields.Str(allow_none=True)
    original_filename = fields.Str()
    file_size = fields.Int()
    shot_at = fields.DateTime(allow_none=True)
    ocr_status = fields.Str()
    created_at = fields.DateTime()


user_schema = UserSchema()
users_schema = UserSchema(many=True)
event_schema = EventSchema()
events_schema = EventSchema(many=True)
event_input_schema = EventInputSchema()
photo_schema = PhotoSchema()
photos_schema = PhotoSchema(many=True)
