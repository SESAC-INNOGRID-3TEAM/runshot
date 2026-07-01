# Worker — OCR 워커 규칙

RabbitMQ에서 메시지를 소비해 사진 OCR을 수행하는 동기 백그라운드 프로세스.
HTTP 서버 아님(포트 없음). main.py 실행 시 큐 소비 무한 루프로 동작.

## 스택
- 동기: pika(동기 연결) + 동기 SQLAlchemy + pytesseract + Pillow + minio(python SDK)

## 구조
- main.py : RabbitMQ ocr_queue 소비 루프, 메시지당 처리 오케스트레이션
- ocr.py : 이미지 전처리(회색조/대비/리사이즈) + Tesseract 실행 + 2~5자리 숫자 후보 추출
- thumbnail.py : 썸네일 생성(최대 720px 너비) → MinIO derived 버킷 저장
- db.py : 워커 전용 DB 세션 + photos/photo_bib_tags 모델을 얇게 재정의(방식 A, backend 미의존)

## 처리 흐름
1. 메시지 소비 {photo_id, storage_key, event_id}
2. ocr_status='processing'으로 변경
3. MinIO에서 원본 다운로드 → 전처리 → Tesseract(숫자 화이트리스트)
4. 2~5자리 후보 추출, confidence 최고값을 대표 배번으로 photo_bib_tags에 INSERT(source='ocr')
5. 썸네일 생성 → derived 버킷 저장
6. 태그 있으면 ocr_status='done', 없으면 'unrecognized'
7. 처리 중 예외는 로그 남기고 unrecognized 처리(MVP는 DLQ 미사용). 워커는 죽지 않고 계속.

## 규칙
- confidence 임계값은 .env(OCR_MIN_CONFIDENCE)로. 배번 자리수도 .env(BIB_MIN/MAX_DIGITS).
- 로그는 JSON 구조화 로깅. 동시성은 코드가 아니라 워커 컨테이너 수로 확장.
