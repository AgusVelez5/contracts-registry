import { showToast } from "./Toast";
import styles from "./CopyableText.module.css";

interface CopyableTextProps {
  value: string;
  display?: string;
}

function CopyableText({ value, display }: CopyableTextProps) {
  const handleCopy = async () => {
    await navigator.clipboard.writeText(value);
    showToast("Copied to clipboard");
  };

  return (
    <button className={styles.copyableText} onClick={handleCopy} title="Click to copy">
      {display ?? value}
    </button>
  );
}

export default CopyableText;