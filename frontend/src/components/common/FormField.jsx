import styles from "./FormField.module.css";

export default function FormField({ label, error, as = "input", className = "", ...rest }) {
  const Tag = as === "textarea" ? "textarea" : "input";
  const controlClass = as === "textarea" ? styles.textarea : styles.input;

  return (
    <div className={styles.field}>
      {label && <label className={styles.label}>{label}</label>}
      <Tag className={`${controlClass} ${className}`} {...rest} />
      {error && <span className={styles.error}>{error}</span>}
    </div>
  );
}
