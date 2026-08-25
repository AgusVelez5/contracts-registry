import styles from "./LoadingState.module.css";

interface LoadingStateProps {
  message?: string;
}

function LoadingState({ message = "Loading..." }: LoadingStateProps) {
  return (
    <div className={styles.loadingState}>
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        className="recheck-spinning"
      >
        <path d="M21 12a9 9 0 1 1-3-6.7"></path>
        <polyline points="21 3 21 9 15 9"></polyline>
      </svg>
      <span>{message}</span>
    </div>
  );
}

export default LoadingState;