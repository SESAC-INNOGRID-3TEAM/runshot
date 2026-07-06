import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import pLimit from "p-limit";
import toast from "react-hot-toast";
import { fetchEvent } from "../api/events";
import { requestPresignedUploads, putToPresignedUrl, completeUploads } from "../api/uploads";
import { fetchUnrecognizedPhotos, addManualTag, requeueOcr } from "../api/photos";
import { formatEventDate } from "../utils/formatDate";
import { formatBytes } from "../utils/formatBytes";
import Spinner from "../components/common/Spinner";
import styles from "./EventUploadPage.module.css";

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_SIZE = 20 * 1024 * 1024;
const MAX_COUNT = 200;
const CONCURRENCY = 5;

let localId = 0;
const nextId = () => `f${++localId}`;

const STATUS_LABEL = {
  queued: "대기",
  uploading: "업로드중",
  done: "완료",
  error: "실패",
};

export default function EventUploadPage() {
  const { id } = useParams();
  const fileInputRef = useRef(null);

  const [event, setEvent] = useState(null);
  const [eventLoading, setEventLoading] = useState(true);

  const [queue, setQueue] = useState([]);
  const [dragActive, setDragActive] = useState(false);
  const [uploading, setUploading] = useState(false);

  const [unrecognized, setUnrecognized] = useState([]);
  const [unrecognizedLoading, setUnrecognizedLoading] = useState(true);
  const [unrecognizedError, setUnrecognizedError] = useState(false);
  const [manualBibInputs, setManualBibInputs] = useState({});

  useEffect(() => {
    let ignore = false;
    fetchEvent(id)
      .then((data) => !ignore && setEvent(data))
      .catch(() => {})
      .finally(() => !ignore && setEventLoading(false));
    return () => {
      ignore = true;
    };
  }, [id]);

  useEffect(() => {
    let ignore = false;
    setUnrecognizedLoading(true);
    fetchUnrecognizedPhotos(id)
      .then((data) => !ignore && setUnrecognized(data))
      .catch(() => !ignore && setUnrecognizedError(true))
      .finally(() => !ignore && setUnrecognizedLoading(false));
    return () => {
      ignore = true;
    };
  }, [id]);

  const updateItem = (itemId, patch) => {
    setQueue((prev) => prev.map((i) => (i.id === itemId ? { ...i, ...patch } : i)));
  };

  const addFiles = (fileList) => {
    const incoming = Array.from(fileList);
    const accepted = [];
    const rejections = [];

    const remainingSlots = MAX_COUNT - queue.length;
    incoming.forEach((file, idx) => {
      if (idx >= remainingSlots) {
        rejections.push(`${file.name}: 회당 최대 ${MAX_COUNT}장까지 업로드할 수 있습니다.`);
        return;
      }
      if (!ALLOWED_TYPES.includes(file.type)) {
        rejections.push(`${file.name}: JPEG/PNG/WEBP 형식만 지원합니다.`);
        return;
      }
      if (file.size > MAX_SIZE) {
        rejections.push(`${file.name}: 파일당 최대 20MB까지 업로드할 수 있습니다.`);
        return;
      }
      accepted.push({
        id: nextId(),
        file,
        previewUrl: URL.createObjectURL(file),
        status: "queued",
        progress: 0,
      });
    });

    if (accepted.length > 0) {
      setQueue((prev) => [...prev, ...accepted]);
    }
    if (rejections.length > 0) {
      toast.error(rejections[0] + (rejections.length > 1 ? ` 외 ${rejections.length - 1}건` : ""));
    }
  };

  const handleFileInputChange = (e) => {
    if (e.target.files?.length) addFiles(e.target.files);
    e.target.value = "";
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragActive(false);
    if (e.dataTransfer.files?.length) addFiles(e.dataTransfer.files);
  };

  const removeItem = (itemId) => {
    setQueue((prev) => prev.filter((i) => i.id !== itemId || i.status === "uploading"));
  };

  const startUpload = async () => {
    const pending = queue.filter((i) => i.status === "queued");
    if (pending.length === 0) {
      toast.error("업로드할 파일을 먼저 선택해주세요.");
      return;
    }

    setUploading(true);
    pending.forEach((item) => updateItem(item.id, { status: "uploading", progress: 0 }));

    try {
      const presigned = await requestPresignedUploads(
        id,
        pending.map((item) => item.file)
      );

      const limit = pLimit(CONCURRENCY);
      const results = await Promise.allSettled(
        pending.map((item, idx) =>
          limit(async () => {
            const info = presigned[idx];
            await putToPresignedUrl(info.upload_url, item.file, (progress) =>
              updateItem(item.id, { progress })
            );
            updateItem(item.id, { status: "done", progress: 100 });
            return {
              photo_id: info.photo_id,
              storage_key: info.storage_key,
              original_filename: item.file.name,
              file_size: item.file.size,
            };
          }).catch((err) => {
            updateItem(item.id, { status: "error" });
            throw err;
          })
        )
      );

      const succeeded = results.filter((r) => r.status === "fulfilled").map((r) => r.value);
      const failedCount = results.length - succeeded.length;

      if (succeeded.length > 0) {
        await completeUploads(id, succeeded);
      }
      if (failedCount === 0) {
        toast.success(`${succeeded.length}장 업로드가 완료되었습니다.`);
      } else {
        toast.error(`${succeeded.length}장 완료, ${failedCount}장 실패했습니다.`);
      }
    } catch {
      pending.forEach((item) => updateItem(item.id, { status: "error", progress: 0 }));
      toast.error("업로드 요청에 실패했습니다. 잠시 후 다시 시도해주세요.");
    } finally {
      setUploading(false);
    }
  };

  const summary = useMemo(() => {
    const totalBytes = queue.reduce((sum, i) => sum + i.file.size, 0);
    const doneCount = queue.filter((i) => i.status === "done").length;
    const errorCount = queue.filter((i) => i.status === "error").length;
    const queuedCount = queue.filter((i) => i.status === "queued").length;
    return { totalBytes, doneCount, errorCount, queuedCount, total: queue.length };
  }, [queue]);

  const handleManualTagSubmit = async (photoId) => {
    const bibNumber = (manualBibInputs[photoId] ?? "").trim();
    if (!bibNumber) {
      toast.error("배번을 입력해주세요.");
      return;
    }
    try {
      await addManualTag(id, photoId, bibNumber);
      setUnrecognized((prev) => prev.filter((p) => p.id !== photoId));
      toast.success(`#${bibNumber} 태그를 추가했습니다.`);
    } catch {
      toast.error("태그 추가에 실패했습니다.");
    }
  };

  const handleRequeue = async (photoId) => {
    try {
      await requeueOcr(id, photoId);
      // pending 상태가 됐으니 미인식 목록에서 제거(처리 결과는 인식 현황 요약에 반영됨).
      setUnrecognized((prev) => prev.filter((p) => p.id !== photoId));
      toast.success("다시 인식을 요청했습니다.");
    } catch (err) {
      toast.error(err.response?.data?.error ?? "다시 인식 요청에 실패했습니다.");
    }
  };

  return (
    <div className={styles.wrapper}>
      {eventLoading ? (
        <Spinner />
      ) : (
        <>
          <h1 className={styles.eventName}>{event?.name ?? `이벤트 #${id}`}</h1>
          {event && (
            <p className={styles.eventMeta}>
              {formatEventDate(event.event_date)} · {event.location}
            </p>
          )}
        </>
      )}

      <div
        className={`${styles.dropzone} ${dragActive ? styles.dropzoneActive : ""}`}
        onDragOver={(e) => {
          e.preventDefault();
          setDragActive(true);
        }}
        onDragLeave={() => setDragActive(false)}
        onDrop={handleDrop}
      >
        <div className={styles.dropzoneIcon}>☁</div>
        <h2 className={styles.dropzoneTitle}>사진 업로드 하기</h2>
        <p className={styles.dropzoneHint}>
          드래그 앤 드롭 또는 파일 탐색기를 이용하여 사진을 업로드하세요.
          <br />
          (지원 형식: JPEG, PNG, WEBP · 파일당 최대 20MB · 회당 최대 200장)
        </p>
        <input
          ref={fileInputRef}
          className={styles.hiddenInput}
          type="file"
          multiple
          accept="image/jpeg,image/png,image/webp"
          onChange={handleFileInputChange}
        />
        <button type="button" className={styles.selectButton} onClick={() => fileInputRef.current?.click()}>
          파일 선택하기
        </button>
      </div>

      {summary.total > 0 && (
        <>
          <div className={styles.summaryRow}>
            <div className={styles.summaryItem}>
              <div className={styles.summaryLabel}>선택된 사진</div>
              <div className={styles.summaryValue}>{summary.total}장</div>
            </div>
            <div className={styles.summaryItem}>
              <div className={styles.summaryLabel}>총 용량</div>
              <div className={styles.summaryValue}>{formatBytes(summary.totalBytes)}</div>
            </div>
            <div className={styles.summaryItem}>
              <div className={styles.summaryLabel}>완료 / 실패</div>
              <div className={styles.summaryValue}>
                {summary.doneCount} / {summary.errorCount}
              </div>
              <div className={styles.progressTrack}>
                <div
                  className={styles.progressFill}
                  style={{ width: `${summary.total ? (summary.doneCount / summary.total) * 100 : 0}%` }}
                />
              </div>
            </div>
          </div>

          <div className={styles.actionsRow}>
            <button
              type="button"
              className={styles.selectButton}
              onClick={startUpload}
              disabled={uploading || summary.queuedCount === 0}
            >
              {uploading ? "업로드 중..." : `${summary.queuedCount}장 업로드 시작`}
            </button>
          </div>

          <div className={styles.queueSection}>
            <h3 className={styles.sectionTitle}>업로드 대기열</h3>
            <div className={styles.queueList}>
              {queue.map((item) => (
                <div key={item.id} className={styles.queueItem}>
                  <img className={styles.thumb} src={item.previewUrl} alt={item.file.name} />
                  <div className={styles.queueInfo}>
                    <div className={styles.queueName}>{item.file.name}</div>
                    <div className={styles.queueMeta}>{formatBytes(item.file.size)}</div>
                    {item.status === "uploading" && (
                      <div className={styles.queueProgressTrack}>
                        <div className={styles.queueProgressFill} style={{ width: `${item.progress}%` }} />
                      </div>
                    )}
                  </div>
                  <span
                    className={`${styles.statusBadge} ${
                      styles[`status${item.status[0].toUpperCase()}${item.status.slice(1)}`]
                    }`}
                  >
                    {STATUS_LABEL[item.status]}
                  </span>
                  {item.status !== "uploading" && (
                    <button
                      type="button"
                      className={styles.removeButton}
                      onClick={() => removeItem(item.id)}
                      aria-label="목록에서 제거"
                    >
                      ✕
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      <div className={styles.queueSection}>
        <h3 className={styles.sectionTitle}>인식 실패 사진 (수동 배번 입력)</h3>
        {unrecognizedLoading && <Spinner />}
        {!unrecognizedLoading && unrecognizedError && (
          <p className={styles.stateText}>목록을 불러오지 못했습니다.</p>
        )}
        {!unrecognizedLoading && !unrecognizedError && unrecognized.length === 0 && (
          <p className={styles.empty}>인식 실패한 사진이 없습니다.</p>
        )}
        {!unrecognizedLoading && !unrecognizedError && unrecognized.length > 0 && (
          <div className={styles.recentGrid}>
            {unrecognized.map((photo) => (
              <div key={photo.id} className={styles.recentCard}>
                <img
                  className={styles.recentThumb}
                  src={photo.thumbnail_url}
                  alt={photo.original_filename}
                />
                <div className={styles.recentMeta}>
                  <input
                    className={styles.tagInput}
                    type="text"
                    inputMode="numeric"
                    placeholder="배번 입력"
                    value={manualBibInputs[photo.id] ?? ""}
                    onChange={(e) =>
                      setManualBibInputs((prev) => ({ ...prev, [photo.id]: e.target.value }))
                    }
                  />
                  <button
                    type="button"
                    className={styles.tagButton}
                    onClick={() => handleManualTagSubmit(photo.id)}
                  >
                    태그 추가
                  </button>
                  <button
                    type="button"
                    className={styles.requeueButton}
                    onClick={() => handleRequeue(photo.id)}
                  >
                    다시 인식
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
