"""최소 기능 스모크 테스트 (SQLite, 인프라 불필요).

실행: .venv/bin/python test_smoke.py
auth 흐름, 이벤트 CRUD, 상태 요약, BUG-01(수동 태그 트랜잭션)을 검증한다.
검색/업로드는 MinIO/Redis/RabbitMQ가 필요하므로 여기선 제외.
"""
from app import create_app
from app.config import Config
from app.extensions import db
from app.models import Photo, User


class TestConfig(Config):
    SQLALCHEMY_DATABASE_URI = "sqlite:///:memory:"
    SQLALCHEMY_ENGINE_OPTIONS = {}


app = create_app(TestConfig)
app.testing = True

with app.app_context():
    db.create_all()

client = app.test_client()


def auth_header(token):
    return {"Authorization": f"Bearer {token}"}


# --- signup (organizer) ---
r = client.post("/api/auth/signup", json={
    "email": "org@test.com", "password": "pass1234", "role": "organizer"})
assert r.status_code == 201, r.get_json()
access = r.get_json()["access_token"]
refresh = r.get_json()["refresh_token"]

# --- 비밀번호 정책 거부 ---
r = client.post("/api/auth/signup", json={"email": "x@test.com", "password": "short"})
assert r.status_code == 400 and "error" in r.get_json()

# --- 중복 이메일 ---
r = client.post("/api/auth/signup", json={"email": "org@test.com", "password": "pass1234"})
assert r.status_code == 409

# --- login ---
r = client.post("/api/auth/login", json={"email": "org@test.com", "password": "pass1234"})
assert r.status_code == 200 and r.get_json()["access_token"]

# --- 잘못된 비번 ---
r = client.post("/api/auth/login", json={"email": "org@test.com", "password": "wrong123"})
assert r.status_code == 401

# --- me ---
r = client.get("/api/auth/me", headers=auth_header(access))
assert r.status_code == 200 and r.get_json()["email"] == "org@test.com"

# --- 인증 없이 이벤트 생성 → 401 ---
r = client.post("/api/events", json={"name": "E", "event_date": "2026-06-01"})
assert r.status_code == 401

# --- 이벤트 생성 (organizer) ---
r = client.post("/api/events", headers=auth_header(access),
                json={"name": "2026 Seoul Marathon", "event_date": "2026-06-01",
                      "location": "Seoul"})
assert r.status_code == 201, r.get_json()
event_id = r.get_json()["id"]

# --- 필수값 누락 검증 ---
r = client.post("/api/events", headers=auth_header(access), json={"name": "no date"})
assert r.status_code == 400

# --- 목록 / 상세(요약) ---
r = client.get("/api/events")
assert r.status_code == 200 and len(r.get_json()["events"]) == 1
r = client.get(f"/api/events/{event_id}")
assert r.status_code == 200 and r.get_json()["summary"]["total"] == 0

# --- admin 전용 삭제를 organizer가 시도 → 403 ---
r = client.delete(f"/api/events/{event_id}", headers=auth_header(access))
assert r.status_code == 403

# --- refresh ---
r = client.post("/api/auth/refresh", json={"refresh_token": refresh})
assert r.status_code == 200 and r.get_json()["access_token"]

# --- BUG-01: 수동 태그 → tag INSERT + ocr_status='done' 한 트랜잭션 ---
with app.app_context():
    uid = User.query.filter_by(email="org@test.com").first().id
    p = Photo(event_id=event_id, uploader_id=uid,
              storage_key="events/x/y.jpg", ocr_status="unrecognized")
    db.session.add(p)
    db.session.commit()
    photo_id = p.id

r = client.post(f"/api/events/{event_id}/photos/{photo_id}/tags",
                headers=auth_header(access), json={"bib_number": 1234})
assert r.status_code == 201, r.get_json()
with app.app_context():
    p = db.session.get(Photo, photo_id)
    assert p.ocr_status == "done"
    assert len(p.bib_tags) == 1 and p.bib_tags[0].bib_number == 1234
    assert p.bib_tags[0].source == "manual"

# --- logout → refresh 무효화 ---
r = client.post("/api/auth/logout", headers=auth_header(access))
assert r.status_code == 200
r = client.post("/api/auth/refresh", json={"refresh_token": refresh})
assert r.status_code == 401

print("SMOKE OK")
