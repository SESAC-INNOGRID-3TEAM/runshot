import apiClient from "./client";
import { USE_MOCK } from "./useMock";
import { MOCK_USERS, MOCK_EVENTS, MOCK_PHOTOS_BY_EVENT, delay } from "./mockData";

export async function fetchUsers() {
  if (USE_MOCK) {
    await delay();
    return MOCK_USERS;
  }
  const res = await apiClient.get("/admin/users");
  return res.data.users;
}

export async function updateUserRole(userId, role) {
  if (USE_MOCK) {
    await delay();
    const user = MOCK_USERS.find((u) => u.id === userId);
    if (user) user.role = role;
    return user;
  }
  const res = await apiClient.patch(`/admin/users/${userId}/role`, { role });
  return res.data;
}

export async function deleteEvent(eventId) {
  if (USE_MOCK) {
    await delay();
    const idx = MOCK_EVENTS.findIndex((e) => e.id === eventId);
    if (idx >= 0) MOCK_EVENTS.splice(idx, 1);
    return;
  }
  await apiClient.delete(`/events/${eventId}`);
}

export async function fetchEventPhotos(eventId, page = 1, perPage = 50) {
  if (USE_MOCK) {
    await delay();
    // 5번째마다 미인식 처리 — 관리 화면의 '다시 인식' 버튼을 mock에서도 볼 수 있게.
    const all = (MOCK_PHOTOS_BY_EVENT[Number(eventId)] ?? []).map((p, i) => {
      const unrec = i % 5 === 4;
      return {
        id: p.id,
        original_filename: `${p.id}.jpg`,
        ocr_status: unrec ? "unrecognized" : "done",
        bib_numbers: unrec ? [] : [p.bib_number],
        shot_at: p.shot_at,
        file_size: 2400000,
        thumbnail_url: p.thumbnail_url,
      };
    });
    const start = (page - 1) * perPage;
    return {
      total: all.length,
      page,
      per_page: perPage,
      photos: all.slice(start, start + perPage),
    };
  }
  const res = await apiClient.get(`/events/${eventId}/photos`, {
    params: { page, per_page: perPage },
  });
  return res.data;
}

export async function deletePhoto(eventId, photoId) {
  if (USE_MOCK) {
    await delay();
    const list = MOCK_PHOTOS_BY_EVENT[Number(eventId)] ?? [];
    const idx = list.findIndex((p) => p.id === photoId);
    if (idx >= 0) list.splice(idx, 1);
    return;
  }
  await apiClient.delete(`/events/${eventId}/photos/${photoId}`);
}
