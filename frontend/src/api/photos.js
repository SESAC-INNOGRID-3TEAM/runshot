import apiClient from "./client";
import { USE_MOCK } from "./useMock";
import { MOCK_PHOTOS_BY_EVENT, MOCK_UNRECOGNIZED_BY_EVENT, delay } from "./mockData";

export async function searchPhotos(eventId, bib) {
  if (USE_MOCK) {
    await delay();
    const photos = MOCK_PHOTOS_BY_EVENT[Number(eventId)] ?? [];
    return photos.filter((p) => String(p.bib_number) === String(bib));
  }
  const res = await apiClient.get(`/events/${eventId}/photos/search`, { params: { bib } });
  // 백엔드: { bib_number, total, photos:[{photo_id, thumbnail_url, original_url, shot_at, confidence}] }
  // → 컴포넌트가 쓰는 { id, thumbnail_url, image_url, shot_at } 형태로 매핑
  return res.data.photos.map((p) => ({
    id: p.photo_id,
    bib_number: res.data.bib_number,
    shot_at: p.shot_at,
    thumbnail_url: p.thumbnail_url,
    image_url: p.original_url,
    confidence: p.confidence,
  }));
}

export async function fetchUnrecognizedPhotos(eventId) {
  if (USE_MOCK) {
    await delay();
    return MOCK_UNRECOGNIZED_BY_EVENT[Number(eventId)] ?? [];
  }
  const res = await apiClient.get(`/events/${eventId}/photos/unrecognized`);
  return res.data.photos;
}

export async function requeueOcr(eventId, photoId) {
  if (USE_MOCK) {
    await delay();
    const list = MOCK_UNRECOGNIZED_BY_EVENT[Number(eventId)] ?? [];
    const idx = list.findIndex((p) => p.id === photoId);
    if (idx >= 0) list.splice(idx, 1);
    return { photo_id: photoId, ocr_status: "pending" };
  }
  const res = await apiClient.post(`/events/${eventId}/photos/${photoId}/reprocess`);
  return res.data;
}

export async function addManualTag(eventId, photoId, bibNumber) {
  if (USE_MOCK) {
    await delay();
    const list = MOCK_UNRECOGNIZED_BY_EVENT[Number(eventId)] ?? [];
    const idx = list.findIndex((p) => p.id === photoId);
    if (idx >= 0) list.splice(idx, 1);
    return { ok: true, bib_number: bibNumber };
  }
  const res = await apiClient.post(`/events/${eventId}/photos/${photoId}/tags`, {
    bib_number: bibNumber,
  });
  return res.data;
}
