import styles from "./Footer.module.css";

export default function Footer() {
  return (
    <footer className={styles.footer}>
      <div className={styles.brand}>RUNSHOT</div>
      <div>© 2026 RunShot. 배번호 사진 검색 서비스.</div>
    </footer>
  );
}
