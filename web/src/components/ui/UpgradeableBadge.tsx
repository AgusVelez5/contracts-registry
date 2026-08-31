import styles from "./UpgradeableBadge.module.css";

const GLOSSARY_URL =
  "https://github.com/AgusVelez5/contracts-registry/blob/main/docs/GLOSSARY.md#upgradeable--proxy";

interface UpgradeableBadgeProps {
  compact?: boolean;
}

function UpgradeableBadge({ compact = false }: UpgradeableBadgeProps) {
  return (
    <a
      href={GLOSSARY_URL}
      target="_blank"
      rel="noopener noreferrer"
      className={styles.badgeLink}
      title="Upgradeable — click to learn more"
    >
      {compact ? (
        <img src="/upgradeable-badge-icon.svg" alt="Upgradeable" className={styles.iconOnly} />
      ) : (
        <img src="/upgradeable-badge.svg" alt="Upgradeable" className={styles.full} />
      )}
    </a>
  );
}

export default UpgradeableBadge;