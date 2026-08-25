import { Link } from "react-router-dom";
import { useState } from "react";
import { useDeploymentEvents } from "../../utils/queries";
import type { DeploymentEvent } from "../../utils/types";
import { timeAgo, formatWei, truncateMiddle } from "../../utils/format";
import { getExplorerUrl, getExplorerTxUrl } from "../../utils/chains";
import CopyableText from "../ui/CopyableText";
import { ExternalLinkIcon, DetailsIcon } from "../ui/icons";
import PaginatedTable from "../ui/PaginatedTable";
import styles from "./DeploymentEventsView.module.css";

interface DeploymentEventsViewProps {
  filter?: string;
  linkToProfile?: boolean;
}

function calculateGasCost(event: DeploymentEvent): string {
  if (!event.gas_used || !event.effective_gas_price) return "—";
  const cost = BigInt(event.gas_used) * BigInt(event.effective_gas_price);
  return formatWei(cost);
}

function DeploymentEventsView({ filter = "", linkToProfile = true }: DeploymentEventsViewProps) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [activeChains, setActiveChains] = useState<number[]>([]);

  const { data, error, isLoading } = useDeploymentEvents({
    page,
    pageSize,
    contract: filter,
    chains: activeChains,
  });

  return (
    <PaginatedTable
      headers={["Contract", "Chain", "Transaction", "Address", "Gas Cost", "When", ""]}
      items={data?.items ?? []}
      total={data?.total ?? 0}
      page={page}
      pageSize={pageSize}
      onPageChange={setPage}
      onPageSizeChange={setPageSize}
      availableChains={data?.available_chains ?? []}
      activeChains={activeChains}
      onChainsChange={setActiveChains}
      isLoading={isLoading}
      error={error}
      tableClassName={`data-table ${styles.historyTable}`}
      emptyMessage="No deployment events found."
      renderRow={(event, i) => {
        const failed = event.status !== null && event.status !== "0x1";
        const txUrl = getExplorerTxUrl(event.chain, event.tx_hash);
        const addressUrl = getExplorerUrl(event.chain, event.address);

        return (
          <tr key={i} className={failed ? styles.failedRow : ""}>
            <td>
              {linkToProfile ? (
                <Link to={`/contract/${event.contract_name}`}>{event.contract_name}</Link>
              ) : (
                event.contract_name
              )}
            </td>
            <td>{event.chain}</td>
            <td className={styles.addressCell}>
              <div className="address-cell-inner">
                <CopyableText value={event.tx_hash} display={truncateMiddle(event.tx_hash)} />
                {txUrl && (
                  <a href={txUrl} target="_blank" rel="noopener noreferrer">
                    <ExternalLinkIcon />
                  </a>
                )}
              </div>
            </td>
            <td className={styles.addressCell}>
              {failed ? (
                <span className="placeholder-text">—</span>
              ) : (
                <div className="address-cell-inner">
                  <CopyableText value={event.address} display={truncateMiddle(event.address)} />
                  {addressUrl && (
                    <a href={addressUrl} target="_blank" rel="noopener noreferrer">
                      <ExternalLinkIcon />
                    </a>
                  )}
                </div>
              )}
            </td>
            <td>
              {calculateGasCost(event)}
              {failed && <span className="status-fail"> · failed</span>}
            </td>
            <td className="verified-at">{timeAgo(event.timestamp * 1000)}</td>
            <td>
              <Link to={`/contract/${event.contract_name}/deployment/${event.tx_hash}`}>
                <DetailsIcon />
              </Link>
            </td>
          </tr>
        );
      }}
    />
  );
}

export default DeploymentEventsView;