import { useMemo, useState } from "react";
import { useFunctions } from "../../utils/queries";
import { truncateMiddle } from "../../utils/format";
import type { ContractInstance, ProxyInfo } from "../../utils/types";
import FunctionCall from "./FunctionCall";
import styles from "./ContractInteract.module.css";

interface ContractInteractProps {
  contractInstances: ContractInstance[];
  initialChain?: number;
  proxyInfo?: Record<string, ProxyInfo>;
}

function ContractInteract({ contractInstances, initialChain, proxyInfo }: ContractInteractProps) {
  const [selectedChain, setSelectedChain] = useState<number | null>(initialChain ?? null);

  // A single contract concept can have multiple real instances sharing a
  // chain (a proxy + a standalone deployment) after the identity merge — pick
  // one per chain, preferring the proxy since that's where the real state lives.
  const instancesByChain = useMemo(() => {
    const map = new Map<number, ContractInstance>();
    for (const instance of contractInstances) {
      const existing = map.get(instance.chain);
      const isProxy = proxyInfo?.[`${instance.chain}:${instance.address.toLowerCase()}`]?.is_proxy;
      if (!existing || isProxy) {
        map.set(instance.chain, instance);
      }
    }
    return Array.from(map.values());
  }, [contractInstances, proxyInfo]);

  const activeInstance =
    instancesByChain.find((i) => i.chain === selectedChain) ?? instancesByChain[0];

  const activeInstanceProxyInfo = activeInstance
    ? proxyInfo?.[`${activeInstance.chain}:${activeInstance.address.toLowerCase()}`]
    : undefined;

  // A proxy whose implementation isn't a known contract in this project has
  // no ABI we can call against — don't even fetch, there's nothing useful to get.
  const hasUnknownImplementation =
    activeInstanceProxyInfo?.is_proxy && !activeInstanceProxyInfo.implementation_contract_name;

  // The call itself must always target the active instance's own address —
  // state lives there (a proxy holds storage via delegatecall). But the ABI
  // must come from whichever contract actually defines the interface: the
  // implementation's, when the active instance is a proxy with a known one.
  const abiContractName = activeInstanceProxyInfo?.is_proxy
    ? activeInstanceProxyInfo.implementation_contract_name ?? activeInstance?.contract_name
    : activeInstance?.contract_name;

  const { data: functions = [] } = useFunctions(
    activeInstance?.chain ?? 0,
    activeInstance?.address ?? "",
    abiContractName ?? "",
    { enabled: !hasUnknownImplementation }
  );

  return (
    <>
      <p className={styles.interactNote}>
        {activeInstance
          ? `Calling functions on the current instance at chain ${activeInstance.chain} (${truncateMiddle(activeInstance.address)}). Older, historical instances are not interactable here.`
          : "No current instance available to interact with."}
      </p>

      {instancesByChain.length > 1 && (
        <div className={styles.chainSelectorWrapper}>
          <label className={styles.chainSelectorLabel}>Chain</label>
          <select
            className={styles.chainSelector}
            value={activeInstance?.chain ?? ""}
            onChange={(e) => setSelectedChain(Number(e.target.value))}
          >
            {instancesByChain.map((instance) => (
              <option key={instance.chain} value={instance.chain}>{instance.chain}</option>
            ))}
          </select>
        </div>
      )}

      {hasUnknownImplementation ? (
        <p className="placeholder-text">
          ⚠ No ABI available — this proxy's implementation isn't tracked as a deployed contract in this project.
        </p>
      ) : activeInstance && functions.length > 0 ? (
        <div className={styles.functionsList}>
          {functions.map((func) => (
            <FunctionCall key={func.name} func={func} instance={activeInstance} abiContractName={abiContractName} />
          ))}
        </div>
      ) : (
        <p className="placeholder-text">No readable functions found, or no deployment to call.</p>
      )}
    </>
  );
}

export default ContractInteract;