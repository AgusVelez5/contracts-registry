export function timeAgo(timestampMs: number): string {
  const diffMs = Date.now() - timestampMs;
  const diffSec = Math.floor(diffMs / 1000);

  if (diffSec < 60) return "just now";
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
}

export function formatBalance(balanceWeiHex: string): string {
  return formatWei(BigInt(balanceWeiHex));
}

export function formatWei(wei: bigint): string {
  const eth = Number(wei) / 1e18;

  if (eth === 0) return "0 ETH";
  if (eth < 0.0001) return "<0.0001 ETH";

  return `${eth.toFixed(4)} ETH`;
}

export function truncateMiddle(str: string, start = 6, end = 4): string {
  if (str.length <= start + end + 3) return str;
  return `${str.slice(0, start)}...${str.slice(-end)}`;
}