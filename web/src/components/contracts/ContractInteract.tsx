import { useState } from "react";
import { useFunctions } from "../../utils/queries";
import { truncateMiddle } from "../../utils/format";
import type { ContractInstance } from "../../utils/types";
import FunctionCall from "./FunctionCall";
import styles from "./ContractInteract.module.css";

interface ContractInteractProps {
  contractInstances: ContractInstance[];
  initialChain?: number;
}

function ContractInteract({ contractInstances, initialChain }: ContractInteractProps) {
  const [selectedChain, setSelectedChain] = useState<number | null>(initialChain ?? null);
  const activeInstance =
    contractInstances.find((i) => i.chain === selectedChain) ?? contractInstances[0];

  const { data: functions = [] } = useFunctions(
    activeInstance?.chain ?? 0,
    activeInstance?.address ?? "",
    activeInstance?.contract_name ?? ""
  );

  return (
    <>
      <p className={styles.interactNote}>
        {activeInstance
          ? `Calling functions on the current instance at chain ${activeInstance.chain} (${truncateMiddle(activeInstance.address)}). Older, historical instances are not interactable here.`
          : "No current instance available to interact with."}
      </p>

      {contractInstances.length > 1 && (
        <div className={styles.chainSelectorWrapper}>
          <label className={styles.chainSelectorLabel}>Chain</label>
          <select
            className={styles.chainSelector}
            value={activeInstance?.chain ?? ""}
            onChange={(e) => setSelectedChain(Number(e.target.value))}
          >
            {contractInstances.map((instance) => (
              <option key={instance.chain} value={instance.chain}>{instance.chain}</option>
            ))}
          </select>
        </div>
      )}

      {activeInstance && functions.length > 0 ? (
        <div className={styles.functionsList}>
          {functions.map((func) => (
            <FunctionCall key={func.name} func={func} instance={activeInstance} />
          ))}
        </div>
      ) : (
        <p className="placeholder-text">No readable functions found, or no deployment to call.</p>
      )}
    </>
  );
}

export default ContractInteract;