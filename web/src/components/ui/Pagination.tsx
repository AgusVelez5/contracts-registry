import styles from "./Pagination.module.css";

interface PaginationProps {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
}

function Pagination({ page, pageSize, total, onPageChange, onPageSizeChange }: PaginationProps) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className={styles.pagination}>
      <select
        className={styles.pageSizeSelect}
        value={pageSize}
        onChange={(e) => onPageSizeChange(Number(e.target.value))}
      >
        <option value={10}>10</option>
        <option value={25}>25</option>
        <option value={50}>50</option>
        <option value={9999}>All</option>
      </select>

      <button className="btn-secondary" onClick={() => onPageChange(page - 1)} disabled={page <= 1}>
        ‹ Prev
      </button>
      <span className={styles.paginationLabel}>Page {page} of {totalPages}</span>
      <button className="btn-secondary" onClick={() => onPageChange(page + 1)} disabled={page >= totalPages}>
        Next ›
      </button>
    </div>
  );
}

export default Pagination;