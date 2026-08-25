import { useEffect, useState } from "react";
import styles from "./Toast.module.css";

type ToastListener = (message: string) => void;
let listener: ToastListener | null = null;

export function showToast(message: string) {
  listener?.(message);
}

const DISPLAY_MS = 1800;
const EXIT_MS = 150;

function Toast() {
  const [message, setMessage] = useState<string | null>(null);
  const [exiting, setExiting] = useState(false);

  useEffect(() => {
    listener = (msg: string) => {
      setMessage(msg);
      setExiting(false);
    };
    return () => {
      listener = null;
    };
  }, []);

  useEffect(() => {
    if (!message) return;

    const exitTimer = setTimeout(() => setExiting(true), DISPLAY_MS);
    return () => clearTimeout(exitTimer);
  }, [message]);

  useEffect(() => {
    if (!exiting) return;

    const removeTimer = setTimeout(() => setMessage(null), EXIT_MS);
    return () => clearTimeout(removeTimer);
  }, [exiting]);

  if (!message) return null;

  return <div className={`${styles.toast} ${exiting ? styles.toastExiting : ""}`}>{message}</div>;
}

export default Toast;