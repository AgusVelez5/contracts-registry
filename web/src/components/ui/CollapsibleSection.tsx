import { useState, type ReactNode } from "react";
import styles from "./CollapsibleSection.module.css";

interface CollapsibleSectionProps {
  title: string;
  count?: number;
  defaultOpen?: boolean;
  children: ReactNode;
}

function CollapsibleSection({ title, count, defaultOpen = true, children }: CollapsibleSectionProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <section className={styles.collapsibleSection}>
      <button
        className={styles.collapsibleSectionHeader}
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
      >
        <span className={`${styles.chevron} ${open ? styles.expanded : ""}`}>▶</span>
        <h3 className={styles.sectionTitle}>
          {title}
          {typeof count === "number" && <span className={styles.sectionCount}> ({count})</span>}
        </h3>
      </button>

      {open && <div>{children}</div>}
    </section>
  );
}

export default CollapsibleSection;