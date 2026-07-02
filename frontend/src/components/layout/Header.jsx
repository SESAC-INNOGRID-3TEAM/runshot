import { Link, NavLink, useNavigate } from "react-router-dom";
import { useAuthStore } from "../../store/authStore";
import { USE_MOCK } from "../../api/useMock";
import Button from "../common/Button";
import styles from "./Header.module.css";

export default function Header() {
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);

  const handleLogout = () => {
    logout();
    navigate("/");
  };

  return (
    <header className={styles.header}>
      <Link to="/" className={styles.logo}>
        RUNSHOT
      </Link>
      {USE_MOCK && <span className={styles.mockBadge}>MOCK DATA</span>}

      <nav className={styles.nav}>
        <NavLink
          to="/events"
          className={({ isActive }) => `${styles.navLink} ${isActive ? styles.navLinkActive : ""}`}
        >
          이벤트
        </NavLink>
        <NavLink
          to="/"
          end
          className={({ isActive }) => `${styles.navLink} ${isActive ? styles.navLinkActive : ""}`}
        >
          나의 사진 찾기
        </NavLink>
        {["organizer", "admin"].includes(user?.role) && (
          <NavLink
            to="/events/new"
            className={({ isActive }) => `${styles.navLink} ${isActive ? styles.navLinkActive : ""}`}
          >
            이벤트 생성
          </NavLink>
        )}
        {user?.role === "admin" && (
          <NavLink
            to="/admin"
            className={({ isActive }) => `${styles.navLink} ${isActive ? styles.navLinkActive : ""}`}
          >
            관리자
          </NavLink>
        )}
      </nav>

      <div className={styles.actions}>
        {user ? (
          <>
            <span className={styles.navLink}>{user.email}</span>
            <Button variant="secondary" onClick={handleLogout}>
              로그아웃
            </Button>
          </>
        ) : (
          <>
            <Link to="/login" className={styles.navLink}>
              로그인
            </Link>
            <Button variant="primary" onClick={() => navigate("/signup")}>
              회원가입
            </Button>
          </>
        )}
      </div>
    </header>
  );
}
