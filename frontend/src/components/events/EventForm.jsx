import { useRef, useState } from "react";
import FormField from "../common/FormField";
import Button from "../common/Button";
import styles from "./EventForm.module.css";

const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp"];

export default function EventForm({ initialValues, submitLabel, submittingLabel, onSubmit, onCancel }) {
  const [form, setForm] = useState({
    name: initialValues?.name ?? "",
    event_date: initialValues?.event_date ?? "",
    location: initialValues?.location ?? "",
    description: initialValues?.description ?? "",
  });
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  // 커버 이미지: 선택한 파일과 미리보기 URL. 수정 모드에서는 기존 커버(cover_url)를 미리보기로.
  const [coverFile, setCoverFile] = useState(null);
  const [coverPreview, setCoverPreview] = useState(initialValues?.cover_url ?? null);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef(null);

  const setField = (field) => (e) => setForm((prev) => ({ ...prev, [field]: e.target.value }));

  const applyCoverFile = (file) => {
    if (!file || !ACCEPTED_TYPES.includes(file.type)) return;
    setCoverFile(file);
    setCoverPreview(URL.createObjectURL(file));
  };

  const handleCoverChange = (e) => applyCoverFile(e.target.files?.[0]);

  const handleDrop = (e) => {
    e.preventDefault();
    setDragActive(false);
    applyCoverFile(e.dataTransfer.files?.[0]);
  };

  const handleRemoveCover = (e) => {
    e.stopPropagation();
    setCoverFile(null);
    setCoverPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const openFilePicker = () => fileInputRef.current?.click();

  const handleDropzoneKeyDown = (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      openFilePicker();
    }
  };

  const validate = () => {
    const next = {};
    if (!form.name.trim()) next.name = "이벤트 이름을 입력해주세요.";
    if (!form.event_date) next.event_date = "날짜를 선택해주세요.";
    if (!form.location.trim()) next.location = "장소를 입력해주세요.";
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    setSubmitting(true);
    try {
      await onSubmit({ ...form, coverFile });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} noValidate>
      <div
        className={`${styles.dropzone} ${dragActive ? styles.dropzoneActive : ""}`}
        role="button"
        tabIndex={0}
        onClick={openFilePicker}
        onKeyDown={handleDropzoneKeyDown}
        onDragOver={(e) => {
          e.preventDefault();
          setDragActive(true);
        }}
        onDragLeave={() => setDragActive(false)}
        onDrop={handleDrop}
      >
        {coverPreview ? (
          <>
            <img
              className={styles.coverPreview}
              src={coverPreview}
              alt="커버 미리보기"
              onError={() => setCoverPreview(null)}
            />
            <div className={styles.dropzoneOverlay}>클릭하거나 끌어놓아 변경</div>
            <button
              type="button"
              className={styles.removeCover}
              onClick={handleRemoveCover}
              aria-label="커버 이미지 제거"
            >
              ×
            </button>
          </>
        ) : (
          <div className={styles.dropzonePlaceholder}>
            <span className={styles.dropzoneIcon}>+</span>
            <span>클릭하거나 이미지를 끌어놓아 커버를 추가하세요</span>
            <span className={styles.dropzoneHint}>JPEG · PNG · WEBP (선택)</span>
          </div>
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept={ACCEPTED_TYPES.join(",")}
          onChange={handleCoverChange}
          className={styles.hiddenInput}
        />
      </div>

      <FormField
        label="이벤트 이름"
        placeholder="예: 2026 섬진강 마라톤"
        value={form.name}
        onChange={setField("name")}
        error={errors.name}
      />
      <FormField
        label="날짜"
        type="date"
        value={form.event_date}
        onChange={setField("event_date")}
        error={errors.event_date}
      />
      <FormField
        label="장소"
        placeholder="예: 전남 구례군"
        value={form.location}
        onChange={setField("location")}
        error={errors.location}
      />
      <FormField
        label="설명 (선택)"
        as="textarea"
        placeholder="이벤트에 대한 간단한 설명을 입력해주세요."
        value={form.description}
        onChange={setField("description")}
      />

      <div className={styles.actions}>
        {onCancel && (
          <Button type="button" variant="secondary" className={styles.cancel} onClick={onCancel}>
            취소
          </Button>
        )}
        <Button type="submit" className={styles.submit} disabled={submitting}>
          {submitting ? submittingLabel : submitLabel}
        </Button>
      </div>
    </form>
  );
}
