import type {
  BalanceResult,
  InstancesResponse,
  FunctionInfo,
  PaginatedDeploymentEventsResponse,
  IntegrityCheckResponse,
  ChainInfo,
} from "./types";

const API_URL = "http://127.0.0.1:3001/v1";

export async function fetchInstances(params: {
  contract?: string;
  chains?: number[];
  page?: number;
  pageSize?: number;
  excludeCurrent?: boolean;
} = {}): Promise<InstancesResponse> {
  const search = new URLSearchParams();
  if (params.contract) search.set("contract", params.contract);
  if (params.chains && params.chains.length > 0) search.set("chains", params.chains.join(","));
  if (params.page) search.set("page", String(params.page));
  if (params.pageSize) search.set("page_size", String(params.pageSize));
  if (params.excludeCurrent) search.set("exclude_current", "true");

  const query = search.toString();
  const response = await fetch(`${API_URL}/instances${query ? `?${query}` : ""}`);
  if (!response.ok) throw new Error(`Failed to fetch instances: ${response.status}`);
  return response.json();
}

export async function fetchIntegrityCheck(params?: {
  chain?: number;
  address?: string;
}): Promise<IntegrityCheckResponse> {
  const search = new URLSearchParams();
  if (params?.chain !== undefined) search.set("chain", String(params.chain));
  if (params?.address) search.set("address", params.address);

  const query = search.toString();
  const response = await fetch(`${API_URL}/integrity-check${query ? `?${query}` : ""}`);
  if (!response.ok) throw new Error(`Failed to fetch integrity check: ${response.status}`);
  return response.json();
}

export async function fetchDeploymentEvents(params: {
  page: number;
  pageSize: number;
  contract?: string;
  chains?: number[];
  txHash?: string;
}): Promise<PaginatedDeploymentEventsResponse> {
  const search = new URLSearchParams();
  search.set("page", String(params.page));
  search.set("page_size", String(params.pageSize));
  if (params.contract) search.set("contract", params.contract);
  if (params.chains && params.chains.length > 0) search.set("chains", params.chains.join(","));
  if (params.txHash) search.set("tx_hash", params.txHash);

  const response = await fetch(`${API_URL}/deployment-events?${search.toString()}`);
  if (!response.ok) throw new Error(`Failed to fetch deployment events: ${response.status}`);
  return response.json();
}

export async function fetchBuildFreshness(contract: string): Promise<{ stale: boolean }> {
  const response = await fetch(`${API_URL}/build-freshness?contract=${encodeURIComponent(contract)}`);
  if (!response.ok) throw new Error(`Failed to fetch build freshness: ${response.status}`);
  return response.json();
}

export async function recompile(): Promise<{ success: boolean; log: string }> {
  const response = await fetch(`${API_URL}/recompile`, { method: "POST" });
  if (!response.ok) throw new Error(`Failed to recompile: ${response.status}`);
  return response.json();
}

export async function fetchFunctions(chain: number, address: string, contract: string): Promise<FunctionInfo[]> {
  const search = new URLSearchParams({ chain: String(chain), address, contract });
  const response = await fetch(`${API_URL}/functions?${search.toString()}`);
  if (!response.ok) throw new Error(`Failed to fetch functions: ${response.status}`);
  return response.json();
}

export async function callFunction(params: {
  chain: number;
  address: string;
  contract: string;
  function_name: string;
  args: string[];
}): Promise<{ result?: string[]; error?: string }> {
  const response = await fetch(`${API_URL}/call-function`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  if (!response.ok) throw new Error(`Failed to call function: ${response.status}`);
  return response.json();
}

export async function fetchBalances(params: {
  contract?: string;
  chains?: number[];
  currentOnly?: boolean;
  address?: string;
} = {}): Promise<BalanceResult[]> {
  const search = new URLSearchParams();
  if (params.contract) search.set("contract", params.contract);
  if (params.chains && params.chains.length > 0) search.set("chain", params.chains.join(","));
  if (params.currentOnly !== undefined) search.set("current_only", String(params.currentOnly));
  if (params.address) search.set("address", params.address);

  const query = search.toString();
  const response = await fetch(`${API_URL}/balances${query ? `?${query}` : ""}`);
  if (!response.ok) throw new Error(`Failed to fetch balances: ${response.status}`);
  return response.json();
}

export async function fetchChains(): Promise<ChainInfo[]> {
  const response = await fetch(`${API_URL}/chains`);
  if (!response.ok) throw new Error(`Failed to fetch chains: ${response.status}`);
  return response.json();
}