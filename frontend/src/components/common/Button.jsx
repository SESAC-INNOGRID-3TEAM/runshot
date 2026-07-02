import styles from "./Button.module.css";

export default function Button({
  variant = "primary",
  type = "button",
  className = "",
  children,
  ...rest
}) {
  const variantClass = variant === "secondary" ? styles.secondary : styles.primary;

  return (
    <button type={type} className={`${styles.button} ${variantClass} ${className}`} {...rest}>
      {children}
    </button>
  );
}
