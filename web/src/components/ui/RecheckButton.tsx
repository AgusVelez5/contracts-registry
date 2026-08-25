import { useEffect, useRef, useState } from "react";

interface RecheckButtonProps {
  onClick: () => void;
  isPending: boolean;
  title?: string;
}

export function RecheckButton({ onClick, isPending, title = "Recheck bytecode match" }: RecheckButtonProps) {
  const [visibleSpin, setVisibleSpin] = useState(false);
  const startRef = useRef<number | null>(null);

  useEffect(() => {
    if (isPending) {
      startRef.current = Date.now();
      setVisibleSpin(true);
    } else if (startRef.current !== null) {
      const elapsed = Date.now() - startRef.current;
      const remaining = Math.max(0, 500 - elapsed);
      const t = setTimeout(() => setVisibleSpin(false), remaining);
      startRef.current = null;
      return () => clearTimeout(t);
    }
  }, [isPending]);

  return (
    <button className="icon-button" onClick={onClick} disabled={isPending} title={title}>
      <svg
        width="13"
        height="13"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        className={visibleSpin ? "recheck-spinning" : ""}
      >
        <path d="M21 12a9 9 0 1 1-3-6.7"></path>
        <polyline points="21 3 21 9 15 9"></polyline>
      </svg>
    </button>
  );
}