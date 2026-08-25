import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { fetchDeploymentEvents } from "../utils/api";
import { timeAgo, formatWei } from "../utils/format";
import { getExplorerTxUrl, getExplorerUrl } from "../utils/chains";
import CopyableText from "../components/ui/CopyableText";
import { ExternalLinkIcon } from "../components/ui/icons";
import LoadingState from "../components/ui/LoadingState";
import ErrorState from "../components/ui/ErrorState";
import styles from "./DeploymentDetailPage.module.css";

function DeploymentDetailPage() {
  const { name, txHash } = useParams<{ name: string; txHash: string }>();

  const { data, isLoading, error } = useQuery({
    queryKey: ["deployment-event", txHash],
    queryFn: () => fetchDeploymentEvents({ page: 1, pageSize: 1, txHash }),
    enabled: !!txHash,
  });

  const event = data?.items[0];

  if (error) {
    return (
      <div>
        <Link to={`/contract/${name}`}>← Back</Link>
        <ErrorState message={error.message} />
      </div>
    );
  }

  if (isLoading) {
    return (
      <div>
        <Link to={`/contract/${name}`}>← Back</Link>
        <LoadingState />
      </div>
    );
  }

  if (!event) {
    return (
      <div>
        <Link to={`/contract/${name}`}>← Back</Link>
        <ErrorState message={`No deployment found for transaction ${txHash}.`} />
      </div>
    );
  }

  const failed = event.status !== null && event.status !== "0x1";
  const gasCost =
    event.gas_used && event.effective_gas_price
      ? formatWei(BigInt(event.gas_used) * BigInt(event.effective_gas_price))
      : "—";
  const txUrl = getExplorerTxUrl(event.chain, event.tx_hash);
  const addressUrl = getExplorerUrl(event.chain, event.address);

  return (
    <div>
      <Link to={`/contract/${name}`}>← Back to {name}</Link>
      <h2>Deployment — {name}</h2>

      <div className={styles.deploymentSummary}>
        <div>
          <span className={styles.label}>Transaction</span>
          <CopyableText value={event.tx_hash} />
          {txUrl && <a href={txUrl} target="_blank" rel="noopener noreferrer"><ExternalLinkIcon /></a>}
        </div>
        <div>
          <span className={styles.label}>Contract Address</span>
          <CopyableText value={event.address} />
          {addressUrl && <a href={addressUrl} target="_blank" rel="noopener noreferrer"><ExternalLinkIcon /></a>}
        </div>
        <div><span className={styles.label}>Chain</span> {event.chain}</div>
        <div><span className={styles.label}>Status</span> {failed ? <span className="status-fail">✕ failed</span> : <span className="status-ok">✓ success</span>}</div>
        <div><span className={styles.label}>Gas Cost</span> {gasCost}</div>
        <div><span className={styles.label}>When</span> {timeAgo(event.timestamp * 1000)}</div>
      </div>

      <h3 className="section-title">Constructor Arguments</h3>
      {event.constructor_args && event.constructor_args.length > 0 ? (
        <p className={styles.argsInline}>{event.constructor_args.join(", ")}</p>
      ) : (
        <p className="placeholder-text">No constructor arguments.</p>
      )}
    </div>
  );
}

export default DeploymentDetailPage;