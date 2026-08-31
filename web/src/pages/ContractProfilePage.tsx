import { useMemo } from "react";
import { useParams, Link, useSearchParams } from "react-router-dom";
import {
  useInstances,
  useIntegrityCheck,
  useBalances,
  useBuildFreshness,
  useRecompileMutation,
  useRecheckInstanceMutation,
  useProxyInfo,
  useContractFamily,
} from "../utils/queries";
import type { ContractInstance, ProxyInfo } from "../utils/types";
import { formatBalance } from "../utils/format";
import { getExplorerUrl } from "../utils/chains";
import DeploymentEventsView from "../components/contracts/DeploymentEventsView";
import HistoricalInstancesView from "../components/contracts/HistoricalInstancesView";
import ContractInteract from "../components/contracts/ContractInteract";
import CollapsibleSection from "../components/ui/CollapsibleSection";
import LoadingState from "../components/ui/LoadingState";
import ErrorState from "../components/ui/ErrorState";
import EmptyState from "../components/ui/EmptyState";
import styles from "./ContractProfilePage.module.css";
import { getCurrentInstances } from "../utils/instances";
import CopyableText from "../components/ui/CopyableText";
import { ExternalLinkIcon } from "../components/ui/icons";
import { RecheckButton } from "../components/ui/RecheckButton";
import { BYTECODE_MATCH_TOOLTIP, getBytecodeMatchStatus } from "../utils/integrity";

function ContractProfilePage() {
  const { name } = useParams<{ name: string }>();
  const [searchParams] = useSearchParams();
  const chainParam = searchParams.get("chain");
  const initialChain = chainParam ? Number(chainParam) : undefined;

  const { data: familyNames, isLoading: familyLoading, error: familyError } = useContractFamily(name);
  const familyFilter = useMemo(() => familyNames?.join(","), [familyNames]);

  const { data: instances, isLoading, error } = useInstances({
    contract: familyFilter,
    exact: true,
    enabled: !!familyFilter,
  });
  const { data: integrityCheck } = useIntegrityCheck();
  const { data: balances = [] } = useBalances();
  const { data: buildFreshness } = useBuildFreshness(name ?? "");
  const { data: proxyInfo } = useProxyInfo();
  const recompileMutation = useRecompileMutation();
  const recheckMutation = useRecheckInstanceMutation();

  const allInstances: ContractInstance[] = instances?.items ?? [];
  const contractInstances: ContractInstance[] = getCurrentInstances(allInstances);

  function findProxyInfo(instance: ContractInstance): ProxyInfo | undefined {
    return proxyInfo?.[`${instance.chain}:${instance.address.toLowerCase()}`];
  }

  // A single contract concept can have multiple real instances sharing a
  // chain (a proxy + a standalone deployment) after the identity merge — show
  // one row per chain, preferring the proxy since its row already surfaces
  // both the proxy and implementation addresses.
  const instancesByChain = useMemo(() => {
    const map = new Map<number, ContractInstance>();
    for (const instance of contractInstances) {
      const existing = map.get(instance.chain);
      const isProxy = findProxyInfo(instance)?.is_proxy;
      if (!existing || isProxy) {
        map.set(instance.chain, instance);
      }
    }
    return Array.from(map.values());
  }, [contractInstances, proxyInfo]);

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

  if (error || familyError) {
    return (
      <div>
        <Link to="/">← Back to overview</Link>
        <ErrorState message={(error ?? familyError)!.message} />
      </div>
    );
  }

  if (familyLoading || isLoading || !instances || !name) {
    return (
      <div>
        <Link to="/">← Back to overview</Link>
        <LoadingState />
      </div>
    );
  }

  if (contractInstances.length === 0) {
    return (
      <div>
        <Link to="/">← Back to overview</Link>
        <h2>{name} Contract</h2>
        <EmptyState
          message={`No current instances found for ${name}.`}
          hint="This contract may only have historical deployments, or hasn't been deployed successfully yet."
        />
      </div>
    );
  }

  const isUpgradeableContract = contractInstances.some((i) => findProxyInfo(i)?.is_proxy);

  const untrackedImplementationInstances = contractInstances.filter((i) => {
    const info = findProxyInfo(i);
    return info?.is_proxy && !info.implementation_contract_name;
  });

  return (
    <div>
      <Link to="/">← Back to overview</Link>
      <h2>{name} Contract</h2>

      {untrackedImplementationInstances.length > 0 && (
        <div className={styles.proxyWarning}>
          ⚠ This contract is a proxy on{" "}
          {untrackedImplementationInstances.map((i, idx) => (
            <span key={i.chain}>
              {idx > 0 && ", "}
              chain {i.chain} (pointing to {findProxyInfo(i)?.implementation_address})
            </span>
          ))}
          , which isn't tracked as a deployed contract in this project — bytecode
          verification and Interact aren't available for {untrackedImplementationInstances.length > 1 ? "those instances" : "that instance"}.
        </div>
      )}

      <div className={styles.profileActions}>
        <button
          className="btn-secondary"
          onClick={() => recompileMutation.mutate()}
          disabled={recompileMutation.isPending || !buildFreshness?.stale}
        >
          {recompileMutation.isPending ? "Recompiling..." : "Recompile"}
        </button>
        {buildFreshness?.stale && (
          <span className={styles.stalenessBadge}>⚠ source modified since last build</span>
        )}
      </div>

      <CollapsibleSection title="Current instances" count={instancesByChain.length}>
        <table className={`data-table ${isUpgradeableContract ? styles.profileTableUpgradeable : styles.profileTable}`}>
          <thead>
            <tr>
              <th>Chain</th>
              {isUpgradeableContract ? (
                <>
                  <th>Proxy Address</th>
                  <th>Implementation Address</th>
                </>
              ) : (
                <th>Address</th>
              )}
              <th title={BYTECODE_MATCH_TOOLTIP}>Bytecode match</th>
              <th>Balance</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {instancesByChain.map((instance, i) => {
              const result = findIntegrityResult(instance);
              const balance = findBalance(instance);
              const {
                className: statusClass,
                text: statusText,
                tooltip: statusTooltip
              } = getBytecodeMatchStatus(result);
              const url = getExplorerUrl(instance.chain, instance.address);
              const info = findProxyInfo(instance);
              const implementationUrl = info?.implementation_address
                ? getExplorerUrl(instance.chain, info.implementation_address)
                : null;
              const isThisRowPending =
                recheckMutation.isPending &&
                recheckMutation.variables?.chain === instance.chain &&
                recheckMutation.variables?.address === instance.address;

              return (
                <tr key={i}>
                  <td>
                    <Link to={`/chain/${instance.chain}`}>{instance.chain}</Link>
                  </td>
                  {isUpgradeableContract ? (
                    <>
                      <td>
                        {info?.is_proxy ? (
                          <div className="address-cell-inner">
                            <CopyableText value={instance.address} display={instance.address} />
                            {url && (
                              <a href={url} target="_blank" rel="noopener noreferrer" title="View on explorer">
                                <ExternalLinkIcon />
                              </a>
                            )}
                          </div>
                        ) : (
                          <span className="placeholder-text">—</span>
                        )}
                      </td>
                      <td>
                        {info?.is_proxy && info.implementation_address ? (
                          <div className="address-cell-inner">
                            <CopyableText
                              value={info.implementation_address}
                              display={info.implementation_address}
                            />
                            {implementationUrl && (
                              <a href={implementationUrl} target="_blank" rel="noopener noreferrer" title="View on explorer">
                                <ExternalLinkIcon />
                              </a>
                            )}
                          </div>
                        ) : (
                          <div className="address-cell-inner">
                            <CopyableText value={instance.address} display={instance.address} />
                            {url && (
                              <a href={url} target="_blank" rel="noopener noreferrer" title="View on explorer">
                                <ExternalLinkIcon />
                              </a>
                            )}
                          </div>
                        )}
                      </td>
                    </>
                  ) : (
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
                  )}
                  <td title={result?.reason ?? statusTooltip}>
                    <span className={statusClass}>{statusText}</span>
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
                  <td>
                    <RecheckButton
                      isPending={isThisRowPending}
                      onClick={() =>
                        recheckMutation.mutate({ chain: instance.chain, address: instance.address })
                      }
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </CollapsibleSection>

      <CollapsibleSection title="Historical instances" defaultOpen={false}>
        <HistoricalInstancesView filter={familyFilter} />
      </CollapsibleSection>

      <CollapsibleSection title="Deployment history">
        <DeploymentEventsView filter={familyFilter} linkToProfile={false} exactMatch />
      </CollapsibleSection>

      <CollapsibleSection title="Interact">
        <ContractInteract contractInstances={contractInstances} initialChain={initialChain} proxyInfo={proxyInfo} />
      </CollapsibleSection>
    </div>
  );
}

export default ContractProfilePage;