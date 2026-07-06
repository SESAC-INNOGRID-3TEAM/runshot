import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { fetchEvent, updateEvent, requestCoverPresigned } from "../api/events";
import { putToPresignedUrl } from "../api/uploads";
import EventForm from "../components/events/EventForm";
import Spinner from "../components/common/Spinner";
import styles from "./EventNewPage.module.css";

export default function EventEditPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [event, setEvent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let ignore = false;
    fetchEvent(id)
      .then((data) => !ignore && setEvent(data))
      .catch(() => !ignore && setError(true))
      .finally(() => !ignore && setLoading(false));
    return () => {
      ignore = true;
    };
  }, [id]);

  const handleSubmit = async (form) => {
    const { coverFile, ...payload } = form;
    try {
      await updateEvent(id, payload);
      if (coverFile) {
        try {
          const { presigned_url } = await requestCoverPresigned(id, coverFile.type);
          await putToPresignedUrl(presigned_url, coverFile, () => {});
        } catch {
          toast.error("커버 이미지 업로드에 실패했습니다.");
        }
      }
      toast.success("이벤트 정보가 수정되었습니다.");
      navigate(`/events/${id}`);
    } catch (err) {
      const message = err.response?.data?.error ?? "이벤트 수정에 실패했습니다.";
      toast.error(message);
    }
  };

  if (loading) return <Spinner />;
  if (error || !event) {
    return (
      <div className={styles.wrapper}>
        <p className={styles.card}>이벤트를 불러오지 못했습니다.</p>
      </div>
    );
  }

  return (
    <div className={styles.wrapper}>
      <div className={styles.card}>
        <h1 className={styles.title}>이벤트 수정</h1>
        <p className={styles.subtitle}>이벤트 정보를 수정합니다.</p>
        <EventForm
          initialValues={event}
          submitLabel="수정 완료"
          submittingLabel="수정 중..."
          onSubmit={handleSubmit}
          onCancel={() => navigate(`/events/${id}`)}
        />
      </div>
    </div>
  );
}
