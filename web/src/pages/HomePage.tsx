import { useState } from "react";
import { Link } from "react-router-dom";
import {
  useInstances,
  useIntegrityCheck,
  useBalances,
  useProxyInfo,
} from "../utils/queries";
import { useRecheckInstanceMutation } from "../utils/queries";
import type { ContractInstance, ProxyInfo } from "../utils/types";
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
import UpgradeableBadge from "../components/ui/UpgradeableBadge";
import { BYTECODE_MATCH_TOOLTIP, getBytecodeMatchStatus } from "../utils/integrity";

type GroupBy = "contract" | "chain";

function groupInstances(
  rows: ContractInstance[],
  groupBy: GroupBy,
  proxyInfo: Record<string, ProxyInfo> | undefined
): Record<string, ContractInstance[]> {
  return rows.reduce((acc, row) => {
    const key = groupBy === "contract" ? getDisplayInfo(row, proxyInfo).label : String(row.chain);
    if (!acc[key]) acc[key] = [];
    acc[key].push(row);
    return acc;
  }, {} as Record<string, ContractInstance[]>);
}

function getDisplayInfo(instance: ContractInstance, proxyInfo: Record<string, ProxyInfo> | undefined) {
  const info = proxyInfo?.[`${instance.chain}:${instance.address.toLowerCase()}`];
  if (info?.is_proxy && info.implementation_contract_name) {
    return { label: info.implementation_contract_name, isUpgradeable: true };
  }
  return { label: instance.contract_name, isUpgradeable: false };
}

function compareDisplay(
  a: { label: string; isUpgradeable: boolean },
  b: { label: string; isUpgradeable: boolean }
) {
  const labelCompare = a.label.localeCompare(b.label);
  if (labelCompare !== 0) return labelCompare;
  return Number(a.isUpgradeable) - Number(b.isUpgradeable);
}

function HomePage() {
  const { data: instances, isLoading, error } = useInstances();
  const { data: balances = [] } = useBalances();
  const { data: integrityCheck } = useIntegrityCheck();
  const { data: proxyInfo } = useProxyInfo();
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

  const allCurrentInstances = getCurrentInstances(instances.items);

  // Hide any specific instance that's the known current implementation of some
  // proxy — keyed by (chain, address), not by contract_name, so a contract
  // name that's a proxy's implementation on one chain but deployed standalone
  // on another chain is only hidden where it's actually acting as an
  // implementation.
  const knownImplementationKeys = new Set(
    Object.entries(proxyInfo ?? {})
      .filter(([, info]) => info.is_proxy && info.implementation_address)
      .map(([key, info]) => {
        const [chain] = key.split(":");
        return `${chain}:${info.implementation_address!.toLowerCase()}`;
      })
  );

  const rows = allCurrentInstances.filter(
    (instance) => !knownImplementationKeys.has(`${instance.chain}:${instance.address.toLowerCase()}`)
  );

  const grouped = groupInstances(rows, groupBy, proxyInfo);

  if (rows.length === 0) {
    return (
      <EmptyState
        message="No deployments found yet."
        hint="Run a Foundry deploy script (forge script ... --broadcast) to see your contracts here."
      />
    );
  }

  const sortedGroupEntries = Object.entries(grouped).sort(([, itemsA], [, itemsB]) => {
    if (groupBy !== "contract") return 0; // chain keys already sort ascending numerically on their own
    return compareDisplay(getDisplayInfo(itemsA[0], proxyInfo), getDisplayInfo(itemsB[0], proxyInfo));
  });

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
          {sortedGroupEntries.map(([groupKey, items]) => {
            const groupDisplay = groupBy === "contract" ? getDisplayInfo(items[0], proxyInfo) : null;

            const sortedItems = groupBy === "chain"
              ? [...items].sort((a, b) => compareDisplay(getDisplayInfo(a, proxyInfo), getDisplayInfo(b, proxyInfo)))
              : items;

            return (
              <>
                <tr
                  key={groupKey}
                  className={`${styles.groupRow} ${expandedGroups.has(groupKey) ? styles.expanded : ""}`}
                  onClick={() => toggleGroup(groupKey)}
                >
                  <td><span className={styles.chevron}>▶</span></td>
                  <td>
                    <div className={styles.groupNameCell}>
                      {groupBy === "contract" ? (
                        <Link to={`/contract/${groupKey}`} onClick={(e) => e.stopPropagation()}>
                          {groupDisplay!.label}
                        </Link>
                      ) : (
                        <Link to={`/chain/${groupKey}`} onClick={(e) => e.stopPropagation()}>
                          {groupKey}
                        </Link>
                      )}
                    </div>
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
                  sortedItems.map((item, i) => {
                    const result = findIntegrityResult(item);
                    const {
                      className: statusClass,
                      text: statusText,
                      tooltip: statusTooltip
                    } = getBytecodeMatchStatus(result);
                    const balance = findBalance(item);
                    const detailColSpan = groupBy === "chain" ? 3 : 2;
                    const explorerUrl = getExplorerUrl(item.chain, item.address);
                    const itemDisplay = getDisplayInfo(item, proxyInfo);
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
                              {groupBy === "contract" ? (
                                <span className={styles.groupNameCell}>
                                  <Link to={`/chain/${item.chain}`}>{item.chain}</Link>
                                  {itemDisplay.isUpgradeable && <UpgradeableBadge compact />}
                                </span>
                              ) : (
                                <span className={styles.groupNameCell}>
                                  {itemDisplay.label}
                                  {itemDisplay.isUpgradeable && <UpgradeableBadge compact />}
                                </span>
                              )}
                            </span>

                            <span className={styles.instanceAddressCell}>
                              <CopyableText value={item.address} display={item.address} />
                              {explorerUrl && (
                                <a href={explorerUrl} target="_blank" rel="noopener noreferrer" title="View on explorer">
                                  <ExternalLinkIcon />
                                </a>
                              )}
                            </span>

                            <span title={result?.reason ?? statusTooltip}>
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
            );
          })}
        </tbody>
      </table>
    </>
  );
}

export default HomePage;