import { useState } from "react";
import { callFunction } from "../../utils/api";
import type { FunctionInfo, ContractInstance } from "../../utils/types";
import styles from "./FunctionCall.module.css";

interface FunctionCallProps {
  func: FunctionInfo;
  instance: ContractInstance;
}

function FunctionCall({ func, instance }: FunctionCallProps) {
  const [args, setArgs] = useState<string[]>(func.inputs.map(() => ""));
  const [result, setResult] = useState<string[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const updateArg = (index: number, value: string) => {
    const next = [...args];
    next[index] = value;
    setArgs(next);
  };

  const handleCall = async () => {
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await callFunction({
        chain: instance.chain,
        address: instance.address,
        contract: instance.contract_name,
        function_name: func.name,
        args,
      });

      if (response.error) {
        setError(response.error);
      } else {
        setResult(response.result ?? []);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.functionCall}>
      <div className={styles.functionHeader}>
        <span className={styles.functionName}>{func.name}</span>
        <span className={styles.functionType}>({func.inputs.map((i) => i.type).join(", ")})</span>

        <button
          className={`btn-secondary ${styles.functionCallBtn}`}
          onClick={handleCall}
          disabled={loading || !func.present}
        >
          {loading ? "Calling..." : func.present ? "Call" : "Not found"}
        </button>
      </div>

      {!func.present && (
        <div className={`${styles.functionResult} status-fail`}>
          ⚠ This function was not found in the deployed contract — recompile and redeploy to sync.
        </div>
      )}

      {func.inputs.length > 0 && (
        <div className={styles.functionInputs}>
          {func.inputs.map((input, i) => (
            <input
              key={i}
              placeholder={`${input.name || `arg${i}`} (${input.type})`}
              value={args[i]}
              onChange={(e) => updateArg(i, e.target.value)}
              className={styles.functionInput}
            />
          ))}
        </div>
      )}

      {error && <div className={`${styles.functionResult} status-fail`}>✕ {error}</div>}
      {result && <div className={`${styles.functionResult} status-ok`}>→ {result.join(", ")}</div>}
    </div>
  );
}

export default FunctionCall;