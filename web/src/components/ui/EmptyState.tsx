import styles from "./EmptyState.module.css";

interface EmptyStateProps {
  message: string;
  hint?: string;
}

function EmptyState({ message, hint }: EmptyStateProps) {
  return (
    <div className={styles.emptyState}>
      <p className={styles.message}>{message}</p>
      {hint && <p className={styles.hint}>{hint}</p>}
    </div>
  );
}

export default EmptyState;