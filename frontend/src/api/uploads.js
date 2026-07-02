import axios from "axios";
import apiClient from "./client";
import { USE_MOCK } from "./useMock";
import { delay } from "./mockData";

export async function requestPresignedUploads(eventId, files) {
  if (USE_MOCK) {
    await delay(300);
    return files.map((file, i) => ({
      photo_id: `mock-${Date.now()}-${i}`,
      upload_url: "mock://upload",
      storage_key: `raw/events/${eventId}/mock-${i}-${file.name}`,
    }));
  }
  const res = await apiClient.post(`/events/${eventId}/photos/presign`, {
    files: files.map((file) => ({
      filename: file.name,
      size: file.size,
      content_type: file.type,
    })),
  });
  return res.data;
}

export async function putToPresignedUrl(uploadUrl, file, onProgress) {
  if (USE_MOCK) {
    for (let pct = 20; pct <= 100; pct += 20) {
      await delay(120);
      onProgress(pct);
    }
    return;
  }
  await axios.put(uploadUrl, file, {
    headers: { "Content-Type": file.type },
    onUploadProgress: (evt) => {
      if (!evt.total) return;
      onProgress(Math.round((evt.loaded / evt.total) * 100));
    },
  });
}

export async function completeUploads(eventId, photos) {
  if (USE_MOCK) {
    await delay(300);
    return { completed: photos.length };
  }
  const res = await apiClient.post(`/events/${eventId}/photos/complete`, { photos });
  return res.data;
}
