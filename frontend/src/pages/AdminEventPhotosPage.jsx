import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import toast from "react-hot-toast";
import { fetchEventPhotos, deletePhoto } from "../api/admin";
import { requeueOcr } from "../api/photos";
import { fetchEvent } from "../api/events";
import PageContainer from "../components/common/PageContainer";
import Spinner from "../components/common/Spinner";
import styles from "./AdminEventPhotosPage.module.css";

const PER_PAGE = 50;

const STATUS_LABELS = {
  pending: "대기",
  processing: "처리 중",
  done: "완료",
  unrecognized: "인식 실패",
};

function formatShotAt(iso) {
  if (!iso) return "-";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString("ko-KR", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function AdminEventPhotosPage() {
  const { id } = useParams();
  const [event, setEvent] = useState(null);
  const [photos, setPhotos] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const totalPages = Math.max(1, Math.ceil(total / PER_PAGE));

  useEffect(() => {
    fetchEvent(id)
      .then(setEvent)
      .catch(() => {});
  }, [id]);

  useEffect(() => {
    let ignore = false;
    setLoading(true);
    setError(false);
    fetchEventPhotos(id, page, PER_PAGE)
      .then((data) => {
        if (ignore) return;
        setPhotos(data.photos);
        setTotal(data.total);
      })
      .catch(() => {
        if (!ignore) setError(true);
      })
      .finally(() => {
        if (!ignore) setLoading(false);
      });
    return () => {
      ignore = true;
    };
  }, [id, page]);

  const handleDelete = async (photoId) => {
    if (!window.confirm("이 사진과 배번호 태그가 함께 삭제됩니다. 계속하시겠습니까?")) {
      return;
    }
    try {
      await deletePhoto(id, photoId);
      setPhotos((current) => current.filter((p) => p.id !== photoId));
      setTotal((t) => Math.max(0, t - 1));
      toast.success("사진이 삭제되었습니다.");
    } catch {
      toast.error("사진 삭제에 실패했습니다.");
    }
  };

  const handleRequeue = async (photoId) => {
    try {
      await requeueOcr(id, photoId);
      setPhotos((current) =>
        current.map((p) => (p.id === photoId ? { ...p, ocr_status: "pending" } : p))
      );
      toast.success("다시 인식을 요청했습니다.");
    } catch (err) {
      toast.error(err.response?.data?.error ?? "다시 인식 요청에 실패했습니다.");
    }
  };

  return (
    <PageContainer>
      <Link className={styles.backLink} to="/admin">
        ← 관리자 페이지
      </Link>
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>
          사진 관리{event ? ` — ${event.name}` : ""}
        </h2>
        <p className={styles.summary}>전체 {total}장</p>

        {loading && <Spinner />}
        {!loading && error && (
          <p className={styles.stateText}>사진 목록을 불러오지 못했습니다.</p>
        )}
        {!loading && !error && photos.length === 0 && (
          <p className={styles.empty}>업로드된 사진이 없습니다.</p>
        )}
        {!loading && !error && photos.length > 0 && (
          <table className={styles.table}>
            <thead>
              <tr>
                <th>썸네일</th>
                <th>파일명</th>
                <th>배번호</th>
                <th>상태</th>
                <th>촬영 시각</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {photos.map((photo) => (
                <tr key={photo.id}>
                  <td>
                    <img
                      className={styles.thumb}
                      src={photo.thumbnail_url}
                      alt={photo.original_filename || "사진"}
                      loading="lazy"
                    />
                  </td>
                  <td>{photo.original_filename || "-"}</td>
                  <td>
                    {photo.bib_numbers?.length > 0
                      ? photo.bib_numbers.map((b) => `#${b}`).join(", ")
                      : "—"}
                  </td>
                  <td>{STATUS_LABELS[photo.ocr_status] ?? photo.ocr_status}</td>
                  <td>{formatShotAt(photo.shot_at)}</td>
                  <td>
                    {photo.ocr_status === "unrecognized" && (
                      <button
                        className={styles.requeueButton}
                        onClick={() => handleRequeue(photo.id)}
                      >
                        다시 인식
                      </button>
                    )}
                    <button
                      className={styles.deleteButton}
                      onClick={() => handleDelete(photo.id)}
                    >
                      삭제
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {!loading && !error && total > PER_PAGE && (
          <div className={styles.pagination}>
            <button
              className={styles.pageButton}
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
            >
              이전
            </button>
            <span className={styles.pageInfo}>
              {page} / {totalPages}
            </span>
            <button
              className={styles.pageButton}
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              다음
            </button>
          </div>
        )}
      </section>
    </PageContainer>
  );
}
