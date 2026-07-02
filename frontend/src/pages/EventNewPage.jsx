import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { createEvent } from "../api/events";
import EventForm from "../components/events/EventForm";
import styles from "./EventNewPage.module.css";

export default function EventNewPage() {
  const navigate = useNavigate();

  const handleSubmit = async (form) => {
    try {
      const event = await createEvent(form);
      toast.success("이벤트가 생성되었습니다.");
      navigate(`/events/${event.id}`);
    } catch (err) {
      const message = err.response?.data?.error ?? "이벤트 생성에 실패했습니다.";
      toast.error(message);
    }
  };

  return (
    <div className={styles.wrapper}>
      <h1 className={styles.title}>이벤트 생성</h1>
      <EventForm submitLabel="이벤트 생성" submittingLabel="생성 중..." onSubmit={handleSubmit} />
    </div>
  );
}
