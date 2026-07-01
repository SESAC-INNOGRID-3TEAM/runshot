# RunShot 배번호 사진 검색 서비스 — 1차 MVP 요구사항 명세서

| | |
|---|---|
| **프로젝트 이름** | RunShot 배번호 사진 검색 서비스 |
| **날짜** | 2026-06-29 |

> **MVP 조건**: 로컬 전용(인터넷 미연결) 환경, 3인 3일 구현  
> ✅ MVP 핵심 항목 + ⚠️ 단순화 후 포함 항목만 수록 (총 32개)

| 구분 | 설명 |
|---|---|
| ✅ MVP 핵심 | 1차 MVP에서 반드시 구현해야 할 항목 |
| ⚠️ 단순화 | MVP에는 포함하되, 구현 범위를 축소/단순화 권장 |

---

## 1. 사용자 인증 및 권한 관리

| 요구사항 ID | 기능명 | 설명 | 역할 | 구분 | 비고 |
|---|---|---|---|:---:|---|
| REQ-1 | 이메일 회원가입/로그인 및 토큰 발급 | 이메일/비밀번호로 회원가입 및 로그인을 제공하고, 로그인 성공 시 JWT Access/Refresh 토큰을 발급한다. | Participant, Photographer, Organizer, Admin | ✅ | |
| REQ-1.1.1 | 회원가입 입력 검증 및 기본 역할 부여 | 이메일 형식과 비밀번호 정책(8자 이상, 영문+숫자)을 검증하고, 신규 사용자의 기본 역할을 Participant로 저장한다. | Admin | ✅ | |
| REQ-1.1.2 | 로그인 및 JWT 발급 정책 | 로그인 성공 시 Access Token(1시간)과 Refresh Token(7일)을 발급하고, 이후 private API 호출 시 Authorization 헤더로 Access Token을 검증한다. | Admin | ⚠️ | Access Token만 사용하고 만료 시간을 길게 설정하는 방식으로 단순화 권장 |
| REQ-1.3 | 역할 기반 접근 제어 및 역할 변경(관리자) | API/화면 접근을 역할(role)로 제어하며, Admin이 사용자 역할을 변경할 수 있다. | Admin | ⚠️ | Admin/Non-Admin 2단계로 단순화 권장 |
| REQ-1.3.1 | 역할 기반 API 접근 제어 | Participant/Photographer/Organizer/Admin 역할에 따라 이벤트 생성, 업로드, 관리 API 접근을 제한한다. | Admin | ⚠️ | MVP에서는 Admin/Non-Admin 2단계로 단순화 권장 |
| REQ-1.3.2 | 관리자 사용자 역할 변경 | Admin이 사용자 목록을 조회하고 특정 사용자의 역할을 변경할 수 있다. | Admin | ✅ | |

---

## 2. 이벤트 관리

| 요구사항 ID | 기능명 | 설명 | 역할 | 구분 | 비고 |
|---|---|---|---|:---:|---|
| REQ-2 | 이벤트 생성/수정(Organizer+) | Organizer 이상이 이벤트 이름/날짜/장소/설명/커버 이미지를 입력해 이벤트를 생성·수정한다. | Organizer, Admin | ✅ | |
| REQ-2.1.1 | 이벤트 생성 폼/API 필드 | 이벤트 생성 시 이름, 날짜, 장소, 설명을 저장하고 organizer_id를 생성자 사용자로 기록한다. | Organizer, Admin | ⚠️ | 커버 이미지 업로드 제외. 텍스트 기반 카드 UI로 대체 권장 |
| REQ-2.1.2 | 이벤트 수정 정책 | Organizer 이상이 이벤트 필드를 수정할 수 있으며, 권한 없는 사용자는 거부된다. | Organizer, Admin | ✅ | |
| REQ-2.2 | 이벤트 목록 조회 | 이벤트 목록을 최신순으로 조회한다. | Participant, Photographer, Organizer, Admin | ⚠️ | 페이지네이션 없이 전체 조회로 단순화 권장 |
| REQ-2.2.1 | 이벤트 목록 정렬 | 이벤트 목록은 최신순으로 정렬한다. | Admin | ⚠️ | MVP에서는 최신순 정렬만 적용, 페이지네이션 제외 가능 |
| REQ-2.3 | 이벤트 상세 및 상태 요약 | 이벤트 상세에서 총 사진 수/인식 완료 수/인식 실패 수 등 업로드·인식 상태를 요약해 보여준다. | Participant, Photographer, Organizer, Admin | ✅ | |
| REQ-2.3.1 | 이벤트 상세 상태 요약 계산 | 이벤트 상세에서 photos의 ocr_status를 집계하여 총 사진 수/인식 완료(done)/인식 실패(unrecognized)를 제공한다. | Admin | ✅ | |
| REQ-2.4 | 이벤트 삭제(Admin) | Admin이 이벤트를 삭제하면 연결된 사진/태그 데이터가 cascade 삭제된다. | Admin | ✅ | |
| REQ-2.4.1 | 이벤트 삭제 및 데이터 정리 | Admin이 이벤트 삭제 시 해당 이벤트의 photos 및 photo_bib_tags가 함께 삭제되도록 cascade 규칙을 적용한다. | Admin | ✅ | |

---

## 3. 사진 대량 업로드 및 저장

| 요구사항 ID | 기능명 | 설명 | 역할 | 구분 | 비고 |
|---|---|---|---|:---:|---|
| REQ-3 | Presigned URL 기반 다중 파일 업로드 | 브라우저에서 다중 파일을 선택해 Presigned PUT URL로 MinIO에 직접 업로드한다(회당 최대 200장/각 20MB). | Photographer, Organizer, Admin | ✅ | 서비스 핵심 차별점 |
| REQ-3.1.1 | Presigned PUT URL 발급 | 업로드 요청 시 파일명/크기/콘텐츠 타입을 받아 MinIO Presigned PUT URL을 발급한다. | Admin | ✅ | |
| REQ-3.1.2 | 업로드 포맷/용량/개수 제한 | JPEG/PNG/WEBP만 허용하며, 파일당 20MB 이하 및 회당 최대 200장 제한을 적용한다. | Admin | ✅ | |
| REQ-3.2 | 업로드 진행률 및 동시성 제어 | 파일별 진행률을 표시하고 동시 업로드를 최대 5개로 제한하며 나머지는 큐잉한다. | Photographer, Organizer, Admin | ✅ | |
| REQ-3.2.1 | 클라이언트 동시 업로드 5개 제한 | 클라이언트는 동시 업로드를 최대 5개로 제한하고, 초과 파일은 큐잉하여 순차적으로 업로드한다. | Photographer, Organizer, Admin | ✅ | |
| REQ-3.2.2 | 파일별 업로드 진행률 표시 | 각 파일 업로드의 진행률을 Progress Bar로 표시한다. | Photographer, Organizer, Admin | ✅ | |

---

## 4. 배번호 자동 인식 파이프라인(비동기 OCR)

| 요구사항 ID | 기능명 | 설명 | 역할 | 구분 | 비고 |
|---|---|---|---|:---:|---|
| REQ-4 | 업로드 완료 알림 및 RabbitMQ 메시지 발행 | 업로드 완료된 사진에 대해 서버가 메타데이터를 저장하고 RabbitMQ 큐에 OCR 작업 메시지를 발행한다. | Photographer, Organizer, Admin | ✅ | |
| REQ-4.1.1 | 업로드 완료 처리 및 사진 메타데이터 저장 | 클라이언트가 업로드 완료를 알리면 photos 레코드(storage_key, original_filename, file_size, shot_at, ocr_status=pending)를 생성/갱신한다. | Admin | ✅ | |
| REQ-4.1.2 | RabbitMQ OCR 작업 메시지 발행 | 업로드 완료된 photo에 대해 event_id와 photo_id/storage_key를 포함한 메시지를 RabbitMQ에 발행한다. | Admin | ✅ | |
| REQ-4.2 | OCR 워커 처리(전처리+Tesseract) | 워커가 메시지를 소비해 이미지 전처리 후 Tesseract OCR로 숫자를 추출하고 상태(done/unrecognized)를 저장한다. | Admin | ✅ | |
| REQ-4.2.1 | 워커 OCR 처리 상태 전이 | 워커는 처리 시작 시 ocr_status=processing으로 변경하고, 완료 시 done 또는 unrecognized로 저장한다. | Admin | ✅ | |
| REQ-4.2.2 | 이미지 전처리 및 Tesseract OCR 실행 | Pillow로 회색조 변환/대비 강화 등 전처리 후 pytesseract로 OCR을 수행한다. | Admin | ✅ | |
| REQ-4.3.1 | 배번 후보 추출 규칙 | OCR 결과에서 2~5자리 숫자 문자열을 후보로 추출하고, confidence가 가장 높은 값을 대표 배번호로 저장한다. | Admin | ✅ | |

---

## 5. 배번호 검색 및 사진 갤러리/다운로드

| 요구사항 ID | 기능명 | 설명 | 역할 | 구분 | 비고 |
|---|---|---|---|:---:|---|
| REQ-5 | 이벤트+배번 검색 API | 이벤트 ID와 배번을 입력받아 해당 태그가 붙은 사진을 조회한다(인식 실패 사진 제외). | Participant, Photographer, Organizer, Admin | ✅ | |
| REQ-5.1.1 | 검색 쿼리 조건 및 정렬 | event_id와 bib_number로 photo_bib_tags를 조회하여 photos를 반환하며, shot_at 오름차순으로 정렬한다. | Admin | ✅ | |
| REQ-5.2 | 검색 결과 갤러리 및 라이트박스 | 검색 결과를 썸네일 그리드로 표시하고, 라이트박스에서 이전/다음 탐색 및 개별 다운로드를 제공한다. | Participant, Photographer, Organizer, Admin | ✅ | |
| REQ-5.2.1 | 검색 결과 썸네일 그리드 | 검색 결과를 3열 반응형 썸네일 그리드로 표시한다. | Participant, Photographer, Organizer, Admin | ✅ | |
| REQ-5.2.2 | 라이트박스 미리보기 및 개별 다운로드 | 사진 클릭 시 라이트박스에서 이전/다음 탐색을 제공하고, Presigned GET URL(유효 1시간)로 개별 다운로드한다. | Participant, Photographer, Organizer, Admin | ✅ | |
| REQ-5.4 | 수동 태그 보정(Organizer/Photographer) | 인식 실패(unrecognized) 사진 목록을 조회하고 배번을 수동 입력하여 태그를 추가한다. | Photographer, Organizer, Admin | ✅ | OCR 인식률 한계(70~85%) 보완에 필수 |
| REQ-5.4.1 | 인식 실패 사진 목록 조회 | Organizer/Photographer가 이벤트의 unrecognized 사진 목록을 조회할 수 있다. | Photographer, Organizer, Admin | ✅ | |
| REQ-5.4.2 | 수동 배번 태그 추가 | 선택한 사진에 배번을 직접 입력하여 photo_bib_tags에 source=manual로 저장하고 검색 대상에 포함한다. | Photographer, Organizer, Admin | ✅ | |

---

## MVP 범위 요약

| 구분 | 항목 수 |
|---|:---:|
| ✅ MVP 핵심 | 26개 |
| ⚠️ 단순화 후 포함 | 6개 |
| **MVP 합계** | **32개** |

> ❌ MVP 제외 항목(10개)은 `RunShot_요구사항명세서_전체_2026-06-29.md` 파일에서 확인할 수 있습니다.
