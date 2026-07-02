import styles from "./PhotoGrid.module.css";

export default function PhotoGrid({ photos, bib, onSelect }) {
  return (
    <div className={styles.grid}>
      {photos.map((photo, index) => (
        <button
          key={photo.id}
          type="button"
          className={styles.cell}
          onClick={() => onSelect(index)}
          aria-label={`사진 ${index + 1} 크게 보기`}
        >
          <img
            className={styles.image}
            src={photo.thumbnail_url ?? photo.image_url}
            alt={`참가번호 ${bib} 사진`}
            loading="lazy"
          />
          {bib && <span className={styles.badge}>#{bib}</span>}
        </button>
      ))}
    </div>
  );
}
