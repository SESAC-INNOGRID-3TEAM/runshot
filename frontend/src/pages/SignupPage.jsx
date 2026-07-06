import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { signup } from "../api/auth";
import FormField from "../components/common/FormField";
import Button from "../components/common/Button";
import fieldStyles from "../components/common/FormField.module.css";
import styles from "./LoginPage.module.css";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PASSWORD_RE = /^(?=.*[A-Za-z])(?=.*\d).{8,}$/;

// admin은 자가 가입 불가(백엔드에서도 차단) — 가입 시 선택 가능한 역할만 나열.
const ROLE_OPTIONS = [
  { value: "participant", label: "참가자" },
  { value: "photographer", label: "사진작가" },
  { value: "organizer", label: "주최자" },
];

export default function SignupPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [role, setRole] = useState("participant");
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  const validate = () => {
    const next = {};
    if (!EMAIL_RE.test(email.trim())) {
      next.email = "올바른 이메일 형식을 입력해주세요.";
    }
    if (!PASSWORD_RE.test(password)) {
      next.password = "8자 이상, 영문+숫자를 포함해주세요.";
    }
    if (password !== passwordConfirm) {
      next.passwordConfirm = "비밀번호가 일치하지 않습니다.";
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    setSubmitting(true);
    try {
      await signup(email.trim(), password, role);
      toast.success("회원가입이 완료되었습니다. 로그인해주세요.");
      navigate("/login");
    } catch (err) {
      const message = err.response?.data?.error ?? "회원가입에 실패했습니다.";
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className={styles.wrapper}>
      <div className={styles.card}>
        <h1 className={styles.title}>회원가입</h1>
        <form onSubmit={handleSubmit} noValidate>
          <FormField
            label="이메일"
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            error={errors.email}
            autoComplete="email"
          />
          <FormField
            label="비밀번호"
            type="password"
            placeholder="8자 이상, 영문+숫자 포함"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            error={errors.password}
            autoComplete="new-password"
          />
          <FormField
            label="비밀번호 확인"
            type="password"
            placeholder="비밀번호 다시 입력"
            value={passwordConfirm}
            onChange={(e) => setPasswordConfirm(e.target.value)}
            error={errors.passwordConfirm}
            autoComplete="new-password"
          />
          <div className={fieldStyles.field}>
            <label className={fieldStyles.label}>가입 유형</label>
            <div className={styles.roleGroup}>
              {ROLE_OPTIONS.map((opt) => (
                <label
                  key={opt.value}
                  className={`${styles.roleOption} ${
                    role === opt.value ? styles.roleOptionActive : ""
                  }`}
                >
                  <input
                    type="radio"
                    name="role"
                    value={opt.value}
                    checked={role === opt.value}
                    onChange={() => setRole(opt.value)}
                    className={styles.roleRadio}
                  />
                  {opt.label}
                </label>
              ))}
            </div>
          </div>
          <Button type="submit" className={styles.submit} disabled={submitting}>
            {submitting ? "가입 중..." : "회원가입"}
          </Button>
        </form>
        <p className={styles.footerText}>
          이미 계정이 있으신가요? <Link to="/login">로그인</Link>
        </p>
      </div>
    </div>
  );
}
