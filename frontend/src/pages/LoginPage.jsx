import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { login } from "../api/auth";
import { useAuthStore } from "../store/authStore";
import FormField from "../components/common/FormField";
import Button from "../components/common/Button";
import styles from "./LoginPage.module.css";

export default function LoginPage() {
  const navigate = useNavigate();
  const setUser = useAuthStore((state) => state.setUser);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!email.trim() || !password) {
      toast.error("이메일과 비밀번호를 입력해주세요.");
      return;
    }

    setSubmitting(true);
    try {
      const data = await login(email.trim(), password);
      setUser(data.user, data.access_token);
      toast.success("로그인되었습니다.");
      navigate("/");
    } catch (err) {
      const message = err.response?.data?.error ?? "로그인에 실패했습니다.";
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className={styles.wrapper}>
      <div className={styles.card}>
        <h1 className={styles.title}>로그인</h1>
        <form onSubmit={handleSubmit} noValidate>
          <FormField
            label="이메일"
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
          />
          <FormField
            label="비밀번호"
            type="password"
            placeholder="비밀번호"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
          />
          <Button type="submit" className={styles.submit} disabled={submitting}>
            {submitting ? "로그인 중..." : "로그인"}
          </Button>
        </form>
        <p className={styles.footerText}>
          아직 계정이 없으신가요? <Link to="/signup">회원가입</Link>
        </p>
      </div>
    </div>
  );
}
