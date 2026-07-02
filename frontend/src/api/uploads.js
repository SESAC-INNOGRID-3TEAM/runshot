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
  const res = await apiClient.post(`/events/${eventId}/upload/presigned`, {
    files: files.map((file) => ({
      filename: file.name,
      content_type: file.type,
      file_size: file.size,
    })),
  });
  // 백엔드: { files:[{presigned_url, storage_key}] } → 업로드 로직이 쓰는 upload_url로 매핑
  return res.data.files.map((f) => ({
    upload_url: f.presigned_url,
    storage_key: f.storage_key,
  }));
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
  const res = await apiClient.post(`/events/${eventId}/upload/complete`, {
    files: photos.map((p) => ({
      storage_key: p.storage_key,
      filename: p.original_filename,
      file_size: p.file_size,
    })),
  });
  // 백엔드: { processed, photo_ids } → 호출부가 쓰는 completed로 매핑
  return { completed: res.data.processed };
}
