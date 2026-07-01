# Frontend — React 규칙

React 18(JavaScript) + Vite + React Router v6 + Axios + Zustand + CSS Modules.

## 규칙
- JavaScript만(.jsx). TypeScript 금지. Tailwind 금지 — 스타일은 CSS Modules(*.module.css).
- API 클라이언트: axios baseURL "/api". 요청 인터셉터로 Authorization 헤더 자동 첨부.
- 전역 상태: Zustand authStore { user, token, setUser, logout }.
- 보호 라우트: 역할별 접근 제한 컴포넌트(ProtectedRoute).
- 에러 알림은 토스트로. 업로드 중 페이지 이탈 시 경고.

## 라우트
- / 랜딩(이벤트 목록)  /login  /signup
- /events  /events/:id(배번 검색 폼)  /events/:id/search?bib=
- /events/:id/upload(photographer+)  /events/new(organizer+)  /admin

## 업로드 UI
- 드래그&드롭 다중 선택(200장), JPEG/PNG/WEBP, 20MB 초과 즉시 에러.
- 동시 업로드 최대 5개(p-limit). 파일별 진행률 Progress Bar.
- 흐름: presigned 요청 → 받은 URL로 직접 PUT(인증 헤더 없이) → complete 배치 호출.

## 갤러리
- 3열 반응형(모바일 2열), 이미지 lazy loading, 라이트박스(이전/다음, ESC, 개별 다운로드).
- 검색 결과 없으면 안내 메시지 + (선택)신고 링크. URL의 bib 파라미터 유지.
