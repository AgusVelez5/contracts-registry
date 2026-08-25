import type { ReactNode } from "react";
import ChainChips from "./ChainChips";
import Pagination from "./Pagination";
import LoadingState from "./LoadingState";
import ErrorState from "./ErrorState";
import EmptyState from "./EmptyState";
import styles from "./PaginatedTable.module.css";

interface PaginatedTableProps<T> {
  headers: ReactNode[];
  items: T[];
  renderRow: (item: T, index: number) => ReactNode;
  total: number;
  page: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
  availableChains: number[];
  activeChains: number[];
  onChainsChange: (chains: number[]) => void;
  isLoading: boolean;
  error?: Error | null;
  tableClassName?: string;
  emptyMessage?: string;
}

function PaginatedTable<T>({
  headers,
  items,
  renderRow,
  total,
  page,
  pageSize,
  onPageChange,
  onPageSizeChange,
  availableChains,
  activeChains,
  onChainsChange,
  isLoading,
  error,
  tableClassName = "data-table",
  emptyMessage = "No results found.",
}: PaginatedTableProps<T>) {
  if (error) return <ErrorState message={error.message} />;
  if (isLoading) return <LoadingState />;

  const toggleChain = (chain: number) => {
    onPageChange(1);
    onChainsChange(
      activeChains.includes(chain)
        ? activeChains.filter((c) => c !== chain)
        : [...activeChains, chain]
    );
  };

  const resetChains = () => {
    onPageChange(1);
    onChainsChange([]);
  };

  if (total === 0) {
    return (
      <div className={styles.paginatedTable}>
        {availableChains.length > 1 && (
          <ChainChips
            availableChains={availableChains}
            activeChains={activeChains}
            onToggle={toggleChain}
            onReset={resetChains}
          />
        )}
        <EmptyState message={emptyMessage} />
      </div>
    );
  }

  return (
    <div className={styles.paginatedTable}>
      {availableChains.length > 1 && (
        <ChainChips
          availableChains={availableChains}
          activeChains={activeChains}
          onToggle={toggleChain}
          onReset={resetChains}
        />
      )}

      <table className={tableClassName}>
        <thead>
          <tr>
            {headers.map((h, i) => (
              <th key={i}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>{items.map((item, i) => renderRow(item, i))}</tbody>
      </table>

      <Pagination
        page={page}
        pageSize={pageSize}
        total={total}
        onPageChange={onPageChange}
        onPageSizeChange={(size) => {
          onPageSizeChange(size);
          onPageChange(1);
        }}
      />
    </div>
  );
}

export default PaginatedTable;