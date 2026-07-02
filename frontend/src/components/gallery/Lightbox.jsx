import { useEffect } from "react";
import styles from "./Lightbox.module.css";

export default function Lightbox({ photos, index, onClose, onPrev, onNext }) {
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft") onPrev();
      if (e.key === "ArrowRight") onNext();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose, onPrev, onNext]);

  const photo = photos[index];
  if (!photo) return null;

  return (
    <div className={styles.overlay} onClick={onClose}>
      <button className={styles.closeButton} onClick={onClose} aria-label="닫기">
        ✕
      </button>

      <button
        className={styles.navButton}
        onClick={(e) => {
          e.stopPropagation();
          onPrev();
        }}
        disabled={index === 0}
        aria-label="이전 사진"
      >
        ←
      </button>

      <div className={styles.imageWrap} onClick={(e) => e.stopPropagation()}>
        <img className={styles.image} src={photo.image_url ?? photo.thumbnail_url} alt="확대 보기" />
        <div className={styles.footer}>
          <span>
            {index + 1} / {photos.length}
          </span>
          <a
            className={styles.downloadButton}
            href={photo.image_url ?? photo.thumbnail_url}
            download
          >
            다운로드
          </a>
        </div>
      </div>

      <button
        className={styles.navButton}
        onClick={(e) => {
          e.stopPropagation();
          onNext();
        }}
        disabled={index === photos.length - 1}
        aria-label="다음 사진"
      >
        →
      </button>
    </div>
  );
}
