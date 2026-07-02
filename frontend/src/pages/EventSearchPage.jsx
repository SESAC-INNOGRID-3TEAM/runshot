import { useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams, Link } from "react-router-dom";
import { searchPhotos } from "../api/photos";
import { fetchEvent } from "../api/events";
import PhotoGrid from "../components/gallery/PhotoGrid";
import Lightbox from "../components/gallery/Lightbox";
import Spinner from "../components/common/Spinner";
import styles from "./EventSearchPage.module.css";

export default function EventSearchPage() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const bib = searchParams.get("bib") ?? "";

  const [event, setEvent] = useState(null);
  const [photos, setPhotos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [sortOrder, setSortOrder] = useState("asc");
  const [lightboxIndex, setLightboxIndex] = useState(null);

  useEffect(() => {
    let ignore = false;
    setLoading(true);
    setError(false);

    Promise.all([fetchEvent(id), searchPhotos(id, bib)])
      .then(([eventData, photoData]) => {
        if (ignore) return;
        setEvent(eventData);
        setPhotos(photoData);
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
  }, [id, bib]);

  const sortedPhotos = useMemo(() => {
    const sorted = [...photos].sort((a, b) => new Date(a.shot_at) - new Date(b.shot_at));
    return sortOrder === "asc" ? sorted : sorted.reverse();
  }, [photos, sortOrder]);

  const handleSaveAll = () => {
    sortedPhotos.forEach((photo, i) => {
      setTimeout(() => {
        const link = document.createElement("a");
        link.href = photo.image_url ?? photo.thumbnail_url;
        link.download = "";
        document.body.appendChild(link);
        link.click();
        link.remove();
      }, i * 300);
    });
  };

  return (
    <div className={styles.wrapper}>
      <div className={styles.headRow}>
        <div>
          <span className={styles.bibLabel}>BIB</span>
          <span className={styles.bibValue}>#{bib || "-"}</span>
          <p className={styles.resultCount}>
            {loading ? "검색 중..." : `${sortedPhotos.length}개의 결과를 찾았습니다.`}
          </p>
        </div>

        <div className={styles.controls}>
          <select
            className={styles.sortSelect}
            value={sortOrder}
            onChange={(e) => setSortOrder(e.target.value)}
          >
            <option value="asc">촬영 시간 오름차순</option>
            <option value="desc">촬영 시간 내림차순</option>
          </select>
          <button
            type="button"
            className={styles.saveAllButton}
            onClick={handleSaveAll}
            disabled={sortedPhotos.length === 0}
          >
            ⬇ 모두 저장하기
          </button>
        </div>
      </div>

      <div className={styles.filterRow}>
        <span className={styles.filterLabel}>FILTERS:</span>
        <span className={`${styles.chip} ${styles.chipActive}`}>
          BIB: #{bib}
          <Link to={`/events/${id}`} className={styles.chipRemove}>
            ×
          </Link>
        </span>
        {event && (
          <Link to={`/events/${id}`} className={`${styles.chip} ${styles.chipOutline}`}>
            EVENT: {event.name}
          </Link>
        )}
        <Link to={`/events/${id}`} className={styles.clearAll}>
          전체 해제
        </Link>
      </div>

      {loading && <Spinner />}
      {!loading && error && <p className={styles.stateText}>검색 결과를 불러오지 못했습니다.</p>}
      {!loading && !error && sortedPhotos.length === 0 && (
        <p className={styles.stateText}>검색 결과가 없습니다. 배번을 다시 확인해주세요.</p>
      )}
      {!loading && !error && sortedPhotos.length > 0 && (
        <PhotoGrid photos={sortedPhotos} bib={bib} onSelect={setLightboxIndex} />
      )}

      {lightboxIndex !== null && (
        <Lightbox
          photos={sortedPhotos}
          index={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
          onPrev={() => setLightboxIndex((i) => Math.max(0, i - 1))}
          onNext={() => setLightboxIndex((i) => Math.min(sortedPhotos.length - 1, i + 1))}
        />
      )}
    </div>
  );
}
