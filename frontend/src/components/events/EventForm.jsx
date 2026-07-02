import { useState } from "react";
import FormField from "../common/FormField";
import Button from "../common/Button";
import styles from "./EventForm.module.css";

export default function EventForm({ initialValues, submitLabel, submittingLabel, onSubmit }) {
  const [form, setForm] = useState({
    name: initialValues?.name ?? "",
    event_date: initialValues?.event_date ?? "",
    location: initialValues?.location ?? "",
    description: initialValues?.description ?? "",
  });
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  const setField = (field) => (e) => setForm((prev) => ({ ...prev, [field]: e.target.value }));

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
      await onSubmit(form);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} noValidate>
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
      <Button type="submit" className={styles.submit} disabled={submitting}>
        {submitting ? submittingLabel : submitLabel}
      </Button>
    </form>
  );
}
