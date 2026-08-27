import { useState } from "react";
import { useInstances, useBalances } from "../../utils/queries";
import { timeAgo, formatBalance } from "../../utils/format";
import { getExplorerUrl } from "../../utils/chains";
import CopyableText from "../ui/CopyableText";
import { ExternalLinkIcon } from "../ui/icons";
import PaginatedTable from "../ui/PaginatedTable";
import styles from "./HistoricalInstancesView.module.css";

interface HistoricalInstancesViewProps {
  filter?: string;
  lockedChain?: number;
}

function HistoricalInstancesView({ filter, lockedChain }: HistoricalInstancesViewProps) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [activeChains, setActiveChains] = useState<number[]>([]);

  const effectiveChains = lockedChain
    ? [lockedChain]
    : activeChains.length > 0
    ? activeChains
    : undefined;

  const { data, isLoading, error } = useInstances({
    contract: filter,
    chains: effectiveChains,
    page,
    pageSize,
    excludeCurrent: true,
  });

  const { data: balances = [] } = useBalances({ contract: filter, currentOnly: false });

  function findBalance(chain: number, address: string) {
    return balances.find((b) => b.chain === chain && b.address.toLowerCase() === address.toLowerCase());
  }

  const headers = lockedChain
    ? ["Contract", "Address", "Balance", "Deployed"]
    : ["Chain", "Address", "Balance", "Deployed"];

  return (
    <PaginatedTable
      headers={headers}
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
      tableClassName={`data-table ${styles.historicalTable}`}
      emptyMessage="No historical instances found."
      lockedChain={lockedChain}
      renderRow={(instance, i) => {
        const url = getExplorerUrl(instance.chain, instance.address);
        const balance = findBalance(instance.chain, instance.address);

        return (
          <tr key={i}>
            <td>{lockedChain ? instance.contract_name : instance.chain}</td>
            <td>
              <div className="address-cell-inner">
                <CopyableText value={instance.address} display={instance.address} />
                {url && (
                  <a href={url} target="_blank" rel="noopener noreferrer" title="View on explorer">
                    <ExternalLinkIcon />
                  </a>
                )}
              </div>
            </td>
            <td>
              {!balance ? (
                "…"
              ) : balance.error ? (
                <span className="status-fail" title={balance.error}>error</span>
              ) : (
                formatBalance(balance.balance_wei!)
              )}
            </td>
            <td className="verified-at">{timeAgo(instance.timestamp * 1000)}</td>
          </tr>
        );
      }}
    />
  );
}

export default HistoricalInstancesView;