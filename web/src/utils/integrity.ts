import type { OnChainBytecodeIntegrityResult } from "./types";

export const BYTECODE_MATCH_TOOLTIP =
  "Compares the on-chain bytecode against your local build. A mismatch usually means your local source doesn't match what's deployed.";

export function getBytecodeMatchStatus(result: OnChainBytecodeIntegrityResult | undefined) {
  if (!result) {
    return { className: "status-pending", text: "not checked", tooltip: BYTECODE_MATCH_TOOLTIP };
  }
  if (result.matches === null) {
    return {
      className: "status-unknown",
      text: "⚠ not verifiable",
      tooltip: result.reason ?? BYTECODE_MATCH_TOOLTIP,
    };
  }
  if (result.matches) {
    return { className: "status-ok", text: "✓ matches", tooltip: BYTECODE_MATCH_TOOLTIP };
  }
  return {
    className: "status-fail",
    text: "✕ mismatch",
    tooltip: result.reason ?? BYTECODE_MATCH_TOOLTIP,
  };
}