import { Link } from "react-router-dom";
import { formatEventDate } from "../../utils/formatDate";
import styles from "./EventCard.module.css";

export default function EventCard({ event }) {
  return (
    <Link to={`/events/${event.id}`} className={styles.card}>
      {event.cover_url && (
        <img
          className={styles.cover}
          src={event.cover_url}
          alt=""
          loading="lazy"
          onError={(e) => {
            e.currentTarget.style.display = "none";
          }}
        />
      )}
      <h3 className={styles.name}>{event.name}</h3>
      <div className={styles.meta}>
        <span>{formatEventDate(event.event_date)}</span>
        <span>{event.location}</span>
      </div>
      {event.description && <p className={styles.description}>{event.description}</p>}
    </Link>
  );
}
