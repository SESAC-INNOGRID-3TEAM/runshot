import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import toast from "react-hot-toast";
import { fetchEvents } from "../api/events";
import EventCard from "../components/events/EventCard";
import Spinner from "../components/common/Spinner";
import styles from "./LandingPage.module.css";

// 집계/실사진 API가 없어 화면설계서 카피를 그대로 옮긴 정적 더미 콘텐츠.
// 실제 통계·갤러리 API가 생기면 이 상수 대신 fetch 결과로 교체해야 한다.
const DUMMY_STATS = [
  {
    value: "2.4M+",
    label: "지금까지 분류한 행사 인증샷",
    description: "AI가 다양한 트레일과 날씨 속에서도 마이크로초 단위로 식별하는 인증샷을 쉽게 찾아보세요.",
  },
  {
    value: "15k",
    label: "등록된 사진 작가",
    description: "여기저기 흩어져있던 채널을 넘어 모두의 커뮤니티로! 누구나 사진을 등록하고 다운로드할 수 있습니다.",
  },
  {
    value: "2000+",
    label: "러닝 커뮤니티",
    description: "러닝 메이트를 찾고 계신가요? 전국 각지에 모여있는 러닝 마니아 친구를 찾아보세요.",
  },
];

const DUMMY_GALLERY_TILES = [
  { size: "large", tag: "LIVE COVERAGE", title: "CHAMONIX SKYRUN", subtitle: "42,000 PHOTOS · JUST ADDED", gradient: "linear-gradient(135deg, #1f2a1a, #0a0a08)" },
  { size: "small", title: "BERLIN CITY NIGHT", gradient: "linear-gradient(135deg, #101820, #0a0a08)" },
  { size: "small", title: "VERRAZZANO START", gradient: "linear-gradient(135deg, #1a1420, #0a0a08)" },
  { size: "wide", tag: "FULL 4K GALLERY", title: "OREGON TRAIL FINALS", subtitle: "NOW OPEN", gradient: "linear-gradient(135deg, #0f1f16, #0a0a08)" },
];

export default function LandingPage() {
  const navigate = useNavigate();
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [selectedEventId, setSelectedEventId] = useState("");
  const [bib, setBib] = useState("");

  useEffect(() => {
    let ignore = false;

    fetchEvents()
      .then((data) => {
        if (ignore) return;
        setEvents(data);
        if (data.length > 0) {
          setSelectedEventId(String(data[0].id));
        }
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
  }, []);

  const handleSearch = (e) => {
    e.preventDefault();

    if (!selectedEventId) {
      toast.error("이벤트를 먼저 선택해주세요.");
      return;
    }
    if (!bib.trim()) {
      toast.error("참가번호를 입력해주세요.");
      return;
    }

    navigate(`/events/${selectedEventId}/search?bib=${encodeURIComponent(bib.trim())}`);
  };

  const quickEvents = events.slice(0, 5);

  return (
    <>
      <section className={styles.hero}>
        <h1 className={styles.title}>
          참가번호로
          <br />
          인증샷을 찾아보세요
        </h1>

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

        {quickEvents.length > 0 && (
          <>
            <p className={styles.quickLabel}>최근 이벤트 보기</p>
            <div className={styles.quickList}>
              {quickEvents.map((event) => (
                <button
                  key={event.id}
                  type="button"
                  className={`${styles.quickChip} ${
                    String(event.id) === selectedEventId ? styles.quickChipActive : ""
                  }`}
                  onClick={() => setSelectedEventId(String(event.id))}
                >
                  {event.name}
                </button>
              ))}
            </div>
          </>
        )}
      </section>

      <section className={styles.statsSection}>
        {DUMMY_STATS.map((stat) => (
          <div key={stat.label} className={styles.statCard}>
            <div className={styles.statValue}>{stat.value}</div>
            <div className={styles.statLabel}>{stat.label}</div>
            <p className={styles.statDescription}>{stat.description}</p>
          </div>
        ))}
      </section>

      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>이벤트 목록</h2>
          <Link to="/events" className={styles.sectionLink}>
            전체보기 →
          </Link>
        </div>

        {loading && <Spinner />}
        {!loading && error && <p className={styles.stateText}>이벤트를 불러오지 못했습니다.</p>}
        {!loading && !error && events.length === 0 && (
          <p className={styles.empty}>등록된 이벤트가 없습니다.</p>
        )}
        {!loading && !error && events.length > 0 && (
          <div className={styles.grid}>
            {events.slice(0, 6).map((event) => (
              <EventCard key={event.id} event={event} />
            ))}
          </div>
        )}
      </section>

      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <div>
            <h2 className={styles.sectionTitle}>라이브 갤러리</h2>
            <p className={styles.sectionSubtitle}>
              <span className={styles.liveDot} /> 진행중인 러닝 이벤트를 찾아보세요. (샘플 이미지)
            </p>
          </div>
          <Link to="/events" className={styles.sectionLink}>
            더보기 →
          </Link>
        </div>

        <div className={styles.galleryGrid}>
          {DUMMY_GALLERY_TILES.map((tile) => (
            <div
              key={tile.title}
              className={`${styles.galleryTile} ${styles[`galleryTile_${tile.size}`]}`}
              style={{ background: tile.gradient }}
            >
              {tile.tag && <span className={styles.galleryTag}>{tile.tag}</span>}
              <div className={styles.galleryText}>
                <div className={styles.galleryTitle}>{tile.title}</div>
                {tile.subtitle && <div className={styles.gallerySubtitle}>{tile.subtitle}</div>}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className={styles.ctaBanner}>
        <h2 className={styles.ctaTitle}>
          순간의 기억을
          <br />
          간직할 기록으로!
        </h2>
        <p className={styles.ctaSubtitle}>
          런샷의 사진작가 네트워크에 가입하세요. 사진을 업로드하는 즉시 AI 기반의 태깅으로
          <br />
          사진과 행사 참가자를 연결하고 더 넓은 러닝 커뮤니티를 형성합니다.
        </p>
        <div className={styles.ctaActions}>
          <Link to="/signup" className={styles.ctaPrimary}>
            사진작가 등록하기
          </Link>
          <Link to="/login" className={styles.ctaSecondary}>
            프로필 작성하기
          </Link>
        </div>
      </section>
    </>
  );
}
