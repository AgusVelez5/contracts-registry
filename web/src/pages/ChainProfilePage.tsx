import { useParams, Link } from "react-router-dom";
import {
  useInstances,
  useIntegrityCheck,
  useBalances,
  useRecheckInstanceMutation,
  useChains,
} from "../utils/queries";
import type { ContractInstance } from "../utils/types";
import { formatBalance, formatWei } from "../utils/format";
import { getExplorerUrl } from "../utils/chains";
import DeploymentEventsView from "../components/contracts/DeploymentEventsView";
import HistoricalInstancesView from "../components/contracts/HistoricalInstancesView";
import CollapsibleSection from "../components/ui/CollapsibleSection";
import LoadingState from "../components/ui/LoadingState";
import ErrorState from "../components/ui/ErrorState";
import EmptyState from "../components/ui/EmptyState";
import styles from "./ChainProfilePage.module.css";
import { getCurrentInstances } from "../utils/instances";
import CopyableText from "../components/ui/CopyableText";
import { ExternalLinkIcon } from "../components/ui/icons";
import { RecheckButton } from "../components/ui/RecheckButton";
import { BYTECODE_MATCH_TOOLTIP, getBytecodeMatchStatus } from "../utils/integrity";

function formatTotalBalance(
  instances: ContractInstance[],
  findBalance: (instance: ContractInstance) => { balance_wei: string | null; error: string | null } | undefined
): string {
  let hasError = false;

  const total = instances.reduce((acc, item) => {
    const balance = findBalance(item);
    if (!balance || balance.balance_wei === null) {
      if (balance?.error) hasError = true;
      return acc;
    }
    return acc + BigInt(balance.balance_wei);
  }, 0n);

  const formatted = formatWei(total);
  return hasError ? `${formatted} (partial)` : formatted;
}

function ChainProfilePage() {
  const { chainId } = useParams<{ chainId: string }>();
  const chain = chainId ? Number(chainId) : undefined;

  const { data: instances, isLoading, error } = useInstances({
    chains: chain ? [chain] : undefined,
  });
  const { data: integrityCheck } = useIntegrityCheck();
  const { data: balances = [] } = useBalances({ chains: chain ? [chain] : undefined });
  const { data: chains = [] } = useChains();
  const recheckMutation = useRecheckInstanceMutation();

  const chainInfo = chains.find((c) => c.chain === chain);

  const allInstances: ContractInstance[] = instances?.items ?? [];
  const currentInstances: ContractInstance[] = getCurrentInstances(allInstances);

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

  if (error) {
    return (
      <div>
        <Link to="/">← Back to overview</Link>
        <ErrorState message={error.message} />
      </div>
    );
  }

  if (isLoading || !instances || !chain) {
    return (
      <div>
        <Link to="/">← Back to overview</Link>
        <LoadingState />
      </div>
    );
  }

  if (currentInstances.length === 0) {
    return (
      <div>
        <Link to="/">← Back to overview</Link>
        <h2>Chain {chain}</h2>
        <EmptyState
          message={`No current instances found on chain ${chain}.`}
          hint="This chain may only have historical deployments, or none yet."
        />
      </div>
    );
  }

  return (
    <div>
      <Link to="/">← Back to overview</Link>
      <h2>Chain {chain}</h2>

      <div className={styles.chainMeta}>
        <span className={styles.metaItem}>
          Total balance: {formatTotalBalance(currentInstances, findBalance)}
        </span>
        {chainInfo?.explorer_url && (
          <a href={chainInfo.explorer_url} target="_blank" rel="noopener noreferrer" className={styles.metaItem}>
            View explorer <ExternalLinkIcon />
          </a>
        )}
      </div>

      <CollapsibleSection title="Current instances" count={currentInstances.length}>
        <table className={`data-table ${styles.chainTable}`}>
          <thead>
            <tr>
              <th>Contract</th>
              <th>Address</th>
              <th title={BYTECODE_MATCH_TOOLTIP}>Bytecode match</th>
              <th>Balance</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {currentInstances.map((instance, i) => {
              const result = findIntegrityResult(instance);
              const balance = findBalance(instance);
              const { 
                className: statusClass, 
                text: statusText, 
                tooltip: statusTooltip 
              } = getBytecodeMatchStatus(result);
              const url = getExplorerUrl(instance.chain, instance.address);
              const isThisRowPending =
                recheckMutation.isPending &&
                recheckMutation.variables?.chain === instance.chain &&
                recheckMutation.variables?.address === instance.address;

              return (
                <tr key={i}>
                  <td>
                    <Link to={`/contract/${instance.contract_name}?chain=${instance.chain}`}>
                      {instance.contract_name}
                    </Link>
                  </td>
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
        <HistoricalInstancesView lockedChain={chain} />
      </CollapsibleSection>

      <CollapsibleSection title="Deployment history">
        <DeploymentEventsView lockedChain={chain} />
      </CollapsibleSection>
    </div>
  );
}

export default ChainProfilePage;