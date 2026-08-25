let explorerUrls: Record<number, string> = {};

export function setExplorerUrls(chains: { chain: number; explorer_url: string | null }[]) {
  explorerUrls = Object.fromEntries(
    chains.filter((c) => c.explorer_url).map((c) => [c.chain, c.explorer_url as string])
  );
}

export function getExplorerUrl(chain: number, address: string): string | null {
  const baseUrl = explorerUrls[chain];
  if (!baseUrl) return null;
  return `${baseUrl}/address/${address}`;
}

export function getExplorerTxUrl(chain: number, txHash: string): string | null {
  const baseUrl = explorerUrls[chain];
  if (!baseUrl) return null;
  return `${baseUrl}/tx/${txHash}`;
}