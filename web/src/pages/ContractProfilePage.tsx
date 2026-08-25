import { useParams, Link, useSearchParams } from "react-router-dom";
import {
  useInstances,
  useIntegrityCheck,
  useBalances,
  useBuildFreshness,
  useRecompileMutation,
  useRecheckInstanceMutation,
} from "../utils/queries";
import type { ContractInstance } from "../utils/types";
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

const BYTECODE_MATCH_TOOLTIP =
  "Compares the on-chain bytecode against your local build. A mismatch usually means your local source doesn't match what's deployed.";

function ContractProfilePage() {
  const { name } = useParams<{ name: string }>();
  const [searchParams] = useSearchParams();
  const chainParam = searchParams.get("chain");
  const initialChain = chainParam ? Number(chainParam) : undefined;

  const { data: instances, isLoading, error } = useInstances({ contract: name });
  const { data: integrityCheck } = useIntegrityCheck();
  const { data: balances = [] } = useBalances();
  const { data: buildFreshness } = useBuildFreshness(name ?? "");
  const recompileMutation = useRecompileMutation();
  const recheckMutation = useRecheckInstanceMutation();

  const allInstances: ContractInstance[] = instances?.items ?? [];
  const contractInstances: ContractInstance[] = getCurrentInstances(allInstances);

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

  if (isLoading || !instances || !name) {
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

  return (
    <div>
      <Link to="/">← Back to overview</Link>
      <h2>{name} Contract</h2>

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

      <CollapsibleSection title="Current instances" count={contractInstances.length}>
        <table className={`data-table ${styles.profileTable}`}>
          <thead>
            <tr>
              <th>Chain</th>
              <th>Address</th>
              <th title={BYTECODE_MATCH_TOOLTIP}>Bytecode match</th>
              <th>Balance</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {contractInstances.map((instance, i) => {
              const result = findIntegrityResult(instance);
              const balance = findBalance(instance);
              const statusClass = !result ? "status-pending" : result.matches ? "status-ok" : "status-fail";
              const statusText = !result ? "not checked" : result.matches ? "✓ matches" : "✕ mismatch";
              const url = getExplorerUrl(instance.chain, instance.address);
              const isThisRowPending =
                recheckMutation.isPending &&
                recheckMutation.variables?.chain === instance.chain &&
                recheckMutation.variables?.address === instance.address;

              return (
                <tr key={i}>
                  <td>{instance.chain}</td>
                  <td>
                    <div className="address-cell-inner">
                      <CopyableText
                        value={instance.address}
                        display={instance.address}
                      />
                      {url && (
                        <a href={url} target="_blank" rel="noopener noreferrer" title="View on explorer">
                          <ExternalLinkIcon />
                        </a>
                      )}
                    </div>
                  </td>
                  <td title={BYTECODE_MATCH_TOOLTIP}>
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
        <HistoricalInstancesView filter={name} />
      </CollapsibleSection>

      <CollapsibleSection title="Deployment history">
        <DeploymentEventsView filter={name} linkToProfile={false} />
      </CollapsibleSection>

      <CollapsibleSection title="Interact">
        <ContractInteract contractInstances={contractInstances} initialChain={initialChain} />
      </CollapsibleSection>
    </div>
  );
}

export default ContractProfilePage;