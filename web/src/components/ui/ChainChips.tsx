import styles from "./ChainChips.module.css";

interface ChainChipsProps {
  availableChains: number[];
  activeChains: number[];
  onToggle: (chain: number) => void;
  onReset: () => void;
}

function ChainChips({ availableChains, activeChains, onToggle, onReset }: ChainChipsProps) {
  const allActive = activeChains.length === 0;

  return (
    <div className={styles.chainChips}>
      <button className={`${styles.chip} ${allActive ? styles.chipActive : ""}`} onClick={onReset}>
        All
      </button>
      {availableChains.map((chain) => (
        <button
          key={chain}
          className={`${styles.chip} ${activeChains.includes(chain) ? styles.chipActive : ""}`}
          onClick={() => onToggle(chain)}
        >
          {chain}
        </button>
      ))}
    </div>
  );
}

export default ChainChips;