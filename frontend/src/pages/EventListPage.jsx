import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { fetchEvents } from "../api/events";
import { useAuthStore } from "../store/authStore";
import EventCard from "../components/events/EventCard";
import PageContainer from "../components/common/PageContainer";
import Button from "../components/common/Button";
import Spinner from "../components/common/Spinner";
import styles from "./EventListPage.module.css";

const CAN_CREATE_ROLES = ["organizer", "admin"];

export default function EventListPage() {
  const user = useAuthStore((state) => state.user);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let ignore = false;

    fetchEvents()
      .then((data) => {
        if (!ignore) setEvents(data);
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

  const canCreate = CAN_CREATE_ROLES.includes(user?.role);

  return (
    <PageContainer>
      <div className={styles.headerRow}>
        <h1 className={styles.title}>이벤트 목록</h1>
        {canCreate && (
          <Link to="/events/new">
            <Button variant="primary">+ 새 이벤트 만들기</Button>
          </Link>
        )}
      </div>

      {loading && <Spinner />}
      {!loading && error && <p className={styles.stateText}>이벤트를 불러오지 못했습니다.</p>}
      {!loading && !error && events.length === 0 && (
        <p className={styles.empty}>등록된 이벤트가 없습니다.</p>
      )}
      {!loading && !error && events.length > 0 && (
        <div className={styles.grid}>
          {events.map((event) => (
            <EventCard key={event.id} event={event} />
          ))}
        </div>
      )}
    </PageContainer>
  );
}
