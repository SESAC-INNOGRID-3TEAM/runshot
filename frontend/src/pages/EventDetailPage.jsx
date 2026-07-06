import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import toast from "react-hot-toast";
import { fetchEvent } from "../api/events";
import { useAuthStore } from "../store/authStore";
import Button from "../components/common/Button";
import Spinner from "../components/common/Spinner";
import { formatEventDate } from "../utils/formatDate";
import styles from "./EventDetailPage.module.css";

const CAN_UPLOAD_ROLES = ["photographer", "organizer", "admin"];
const CAN_EDIT_ROLES = ["organizer", "admin"];

export default function EventDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const [event, setEvent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [bib, setBib] = useState("");

  useEffect(() => {
    let ignore = false;
    setLoading(true);
    setError(false);

    fetchEvent(id)
      .then((data) => {
        if (!ignore) setEvent(data);
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
  }, [id]);

  const handleSearch = (e) => {
    e.preventDefault();
    if (!bib.trim()) {
      toast.error("참가번호를 입력해주세요.");
      return;
    }
    navigate(`/events/${id}/search?bib=${encodeURIComponent(bib.trim())}`);
  };

  if (loading) {
    return <Spinner />;
  }

  if (error || !event) {
    return <p className={styles.stateText}>이벤트를 불러오지 못했습니다.</p>;
  }

  const canUpload = CAN_UPLOAD_ROLES.includes(user?.role);
  const canEdit = CAN_EDIT_ROLES.includes(user?.role);
  const summary = event.photo_summary;

  return (
    <div className={styles.wrapper}>
      <Link to="/events" className={styles.backLink}>
        ← 이벤트 목록
      </Link>

      {event.cover_url && (
        <img
          className={styles.cover}
          src={event.cover_url}
          alt=""
          onError={(e) => {
            e.currentTarget.style.display = "none";
          }}
        />
      )}

      <section className={styles.infoSection}>
        <div className={styles.infoHead}>
          <div>
            <h1 className={styles.name}>{event.name}</h1>
            <div className={styles.meta}>
              <span>{formatEventDate(event.event_date)}</span>
              <span className={styles.metaDivider}>·</span>
              <span>{event.location}</span>
            </div>
          </div>

          {(canEdit || canUpload) && (
            <div className={styles.actions}>
              {canEdit && (
                <Link to={`/events/${id}/edit`}>
                  <Button variant="secondary">이벤트 정보 수정</Button>
                </Link>
              )}
              {canUpload && (
                <Link to={`/events/${id}/upload`}>
                  <Button variant="primary">사진 업로드하기</Button>
                </Link>
              )}
            </div>
          )}
        </div>

        {event.description && <p className={styles.description}>{event.description}</p>}
      </section>

      {summary && (
        <section className={styles.panel}>
          <h2 className={styles.panelTitle}>인식 현황</h2>
          <div className={styles.summary}>
            <div className={styles.summaryCard}>
              <div className={styles.summaryValue}>{summary.total}</div>
              <div className={styles.summaryLabel}>총 사진 수</div>
            </div>
            <div className={styles.summaryCard}>
              <div className={styles.summaryValue}>{summary.done}</div>
              <div className={styles.summaryLabel}>인식 완료</div>
            </div>
            <div className={styles.summaryCard}>
              <div className={styles.summaryValue}>{summary.unrecognized}</div>
              <div className={styles.summaryLabel}>인식 실패</div>
            </div>
          </div>
        </section>
      )}

      <section className={`${styles.panel} ${styles.searchPanel}`}>
        <h2 className={styles.panelTitle}>참가번호로 사진 찾기</h2>
        <form className={styles.searchPill} onSubmit={handleSearch}>
          <input
            className={styles.input}
            type="text"
            inputMode="numeric"
            placeholder="참가번호 입력하기"
            value={bib}
            onChange={(e) => setBib(e.target.value)}
          />
          <button type="submit" className={styles.searchButton}>
            검색 →
          </button>
        </form>
      </section>
    </div>
  );
}
