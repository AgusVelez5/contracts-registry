import styles from "./ErrorState.module.css";

interface ErrorStateProps {
  message: string;
}

function ErrorState({ message }: ErrorStateProps) {
  const looksLikeMissingConfig = message.toLowerCase().includes("registry.config.json");

  return (
    <div className={styles.errorState}>
      <p className={styles.errorMessage}>⚠ {message}</p>
      {looksLikeMissingConfig && (
        <p className={styles.errorHint}>
          Make sure you're running this command from the root of your Foundry project,
          with a <code>registry.config.json</code> file present.
        </p>
      )}
    </div>
  );
}

export default ErrorState;