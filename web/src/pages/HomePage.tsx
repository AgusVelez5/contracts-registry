import { useState } from "react";
import { Link } from "react-router-dom";
import {
  useInstances,
  useIntegrityCheck,
  useBalances,
} from "../utils/queries";
import { useRecheckInstanceMutation } from "../utils/queries";
import type { ContractInstance } from "../utils/types";
import { formatBalance, formatWei } from "../utils/format";
import { getExplorerUrl } from "../utils/chains";
import styles from "./HomePage.module.css";
import { getCurrentInstances } from "../utils/instances";
import CopyableText from "../components/ui/CopyableText";
import { ExternalLinkIcon, DetailsIcon } from "../components/ui/icons";
import { RecheckButton } from "../components/ui/RecheckButton";
import ErrorState from "../components/ui/ErrorState";
import LoadingState from "../components/ui/LoadingState";
import EmptyState from "../components/ui/EmptyState";
import SiteNav from "../components/SiteNav";

type GroupBy = "contract" | "chain";

const BYTECODE_MATCH_TOOLTIP =
  "Compares the on-chain bytecode against your local build. A mismatch usually means your local source doesn't match what's deployed.";

function groupInstances(rows: ContractInstance[], groupBy: GroupBy): Record<string, ContractInstance[]> {
  const key = groupBy === "contract" ? "contract_name" : "chain";

  return rows.reduce((acc, row) => {
    const groupKey = String(row[key]);
    if (!acc[groupKey]) acc[groupKey] = [];
    acc[groupKey].push(row);
    return acc;
  }, {} as Record<string, ContractInstance[]>);
}

function HomePage() {
  const { data: instances, isLoading, error } = useInstances();
  const { data: balances = [] } = useBalances();
  const { data: integrityCheck } = useIntegrityCheck();
  const recheckMutation = useRecheckInstanceMutation();

  const [groupBy, setGroupBy] = useState<GroupBy>("contract");
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  const toggleGroup = (groupKey: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(groupKey)) {
        next.delete(groupKey);
      } else {
        next.add(groupKey);
      }
      return next;
    });
  };

  const integrityResults = integrityCheck ? Object.values(integrityCheck).flat() : [];

  function findIntegrityResult(instance: ContractInstance) {
    return integrityResults.find(
      (r) => r.address === instance.address && r.chain === instance.chain
    );
  }

  function findBalance(instance: ContractInstance) {
    return balances.find(
      (b) => b.address === instance.address && b.chain === instance.chain
    );
  }

  function formatTotalBalance(items: ContractInstance[]): string {
    let hasError = false;

    const total = items.reduce((acc, item) => {
      const balance = findBalance(item);
      if (!balance || balance.balance_wei === null) {
        if (balance?.error) hasError = true;
        return acc;
      }
      return acc + BigInt(balance.balance_wei);
    }, 0n);

    if (hasError) return `${formatWei(total)} (partial)`;
    return formatWei(total);
  }

  if (error) return <ErrorState message={error.message} />;
  if (isLoading || !instances) return <LoadingState />;

  const rows = getCurrentInstances(instances.items);
  const grouped = groupInstances(rows, groupBy);

  if (rows.length === 0) {
    return (
      <EmptyState
        message="No deployments found yet."
        hint="Run a Foundry deploy script (forge script ... --broadcast) to see your contracts here."
      />
    );
  }

  return (
    <>
      <SiteNav />

      <div className={styles.controls}>
        <select value={groupBy} onChange={(e) => setGroupBy(e.target.value as GroupBy)}>
          <option value="contract">Group by contract</option>
          <option value="chain">Group by chain</option>
        </select>
      </div>

      <table className={styles.registryTable}>
        <colgroup>
          <col style={{ width: "32px" }} />
          <col />
          <col style={{ width: "140px" }} />
          {groupBy === "chain" && <col style={{ width: "160px" }} />}
        </colgroup>
        <thead>
          <tr>
            <th></th>
            <th>{groupBy === "contract" ? "Contract" : "Chain"}</th>
            <th>Instances</th>
            {groupBy === "chain" && <th>Total Balance</th>}
          </tr>
        </thead>
        <tbody>
          {Object.entries(grouped).map(([groupKey, items]) => (
            <>
              <tr
                key={groupKey}
                className={`${styles.groupRow} ${expandedGroups.has(groupKey) ? styles.expanded : ""}`}
                onClick={() => toggleGroup(groupKey)}
              >
                <td><span className={styles.chevron}>▶</span></td>
                <td>
                  {groupBy === "contract" ? (
                    <Link to={`/contract/${groupKey}`} onClick={(e) => e.stopPropagation()}>
                      {groupKey}
                    </Link>
                  ) : (
                    groupKey
                  )}
                </td>
                <td className={styles.count}>{items.length}</td>
                {groupBy === "chain" && (
                  <td className={styles.count}>{formatTotalBalance(items)}</td>
                )}
              </tr>

              {expandedGroups.has(groupKey) && (
                <tr className={styles.detailHeaderRow}>
                  <td></td>
                  <td colSpan={groupBy === "chain" ? 3 : 2}>
                    <div className={`${styles.instanceRowGrid} ${styles.instanceRowGridHeader}`}>
                      <span>{groupBy === "contract" ? "Chain" : "Contract"}</span>
                      <span>Address</span>
                      <span title={BYTECODE_MATCH_TOOLTIP}>Bytecode match</span>
                      <span>Balance</span>
                      <span></span>
                    </div>
                  </td>
                </tr>
              )}

              {expandedGroups.has(groupKey) &&
                items.map((item, i) => {
                  const result = findIntegrityResult(item);
                  const statusClass = !result
                    ? "status-pending"
                    : result.matches === null
                    ? "status-unknown"
                    : result.matches
                    ? "status-ok"
                    : "status-fail";
                  const statusText = !result
                    ? "not checked"
                    : result.matches === null
                    ? "⚠ not verifiable"
                    : result.matches
                    ? "✓ matches"
                    : "✕ mismatch";
                  const balance = findBalance(item);
                  const detailColSpan = groupBy === "chain" ? 3 : 2;
                  const explorerUrl = getExplorerUrl(item.chain, item.address);
                  const isThisRowPending =
                    recheckMutation.isPending &&
                    recheckMutation.variables?.chain === item.chain &&
                    recheckMutation.variables?.address === item.address;

                  return (
                    <tr key={`${groupKey}-${i}`} className={styles.detailRow}>
                      <td></td>
                      <td colSpan={detailColSpan}>
                        <div className={styles.instanceRowGrid}>
                          <span className={styles.instanceContext}>
                            {groupBy === "contract" ? item.chain : item.contract_name}
                          </span>

                          <span className={styles.instanceAddressCell}>
                            <CopyableText value={item.address} display={item.address} />
                            {explorerUrl && (
                              <a href={explorerUrl} target="_blank" rel="noopener noreferrer" title="View on explorer">
                                <ExternalLinkIcon />
                              </a>
                            )}
                          </span>

                          <span title={result?.reason ?? BYTECODE_MATCH_TOOLTIP}>
                            <span className={statusClass}>{statusText}</span>
                          </span>

                          <span className="balance">
                            {!balance ? (
                              "…"
                            ) : balance.error ? (
                              <span className="status-fail" title={balance.error}>error</span>
                            ) : (
                              formatBalance(balance.balance_wei!)
                            )}
                          </span>

                          <div className={styles.rowActions}>
                            <RecheckButton
                              isPending={isThisRowPending}
                              onClick={() => recheckMutation.mutate({ chain: item.chain, address: item.address })}
                            />
                            <Link
                              to={`/contract/${item.contract_name}?chain=${item.chain}`}
                              title="View contract profile"
                              className={styles.detailsLink}
                            >
                              <DetailsIcon />
                            </Link>
                          </div>
                        </div>
                      </td>
                    </tr>
                  );
                })}
            </>
          ))}
        </tbody>
      </table>
    </>
  );
}

export default HomePage;