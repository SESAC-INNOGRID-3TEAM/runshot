import styles from "./Spinner.module.css";

export default function Spinner({ label = "불러오는 중..." }) {
  return (
    <div className={styles.wrapper}>
      <span className={styles.ring} />
      {label && <span>{label}</span>}
    </div>
  );
}
