import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { createEvent, requestCoverPresigned } from "../api/events";
import { putToPresignedUrl } from "../api/uploads";
import EventForm from "../components/events/EventForm";
import styles from "./EventNewPage.module.css";

export default function EventNewPage() {
  const navigate = useNavigate();

  const handleSubmit = async (form) => {
    const { coverFile, ...payload } = form;
    try {
      const event = await createEvent(payload);
      if (coverFile) {
        try {
          const { presigned_url } = await requestCoverPresigned(event.id, coverFile.type);
          await putToPresignedUrl(presigned_url, coverFile, () => {});
        } catch {
          // 커버 업로드 실패는 이벤트 생성 성공을 막지 않는다(수정 화면에서 재시도 가능).
          toast.error("커버 이미지 업로드에 실패했습니다.");
        }
      }
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
