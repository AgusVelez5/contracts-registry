import type {
  BalanceResult,
  InstancesResponse,
  FunctionInfo,
  PaginatedDeploymentEventsResponse,
  IntegrityCheckResponse,
  ChainInfo,
} from "./types";

const API_URL = import.meta.env.DEV ? "http://127.0.0.1:3001/v1" : "/v1";

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);

  if (!response.ok) {
    let message = `Request failed with status ${response.status}`;
    try {
      const body = await response.json();
      if (body?.error) message = body.error;
    } catch {
      // response body wasn't valid JSON — keep the generic message
    }
    throw new Error(message);
  }

  return response.json();
}

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
  return fetchJson<InstancesResponse>(`${API_URL}/instances${query ? `?${query}` : ""}`);
}

export async function fetchIntegrityCheck(params?: {
  chain?: number;
  address?: string;
}): Promise<IntegrityCheckResponse> {
  const search = new URLSearchParams();
  if (params?.chain !== undefined) search.set("chain", String(params.chain));
  if (params?.address) search.set("address", params.address);

  const query = search.toString();
  return fetchJson<IntegrityCheckResponse>(`${API_URL}/integrity-check${query ? `?${query}` : ""}`);
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

  return fetchJson<PaginatedDeploymentEventsResponse>(`${API_URL}/deployment-events?${search.toString()}`);
}

export async function fetchBuildFreshness(contract: string): Promise<{ stale: boolean }> {
  return fetchJson<{ stale: boolean }>(`${API_URL}/build-freshness?contract=${encodeURIComponent(contract)}`);
}

export async function recompile(): Promise<{ success: boolean; log: string }> {
  return fetchJson<{ success: boolean; log: string }>(`${API_URL}/recompile`, { method: "POST" });
}

export async function fetchFunctions(chain: number, address: string, contract: string): Promise<FunctionInfo[]> {
  const search = new URLSearchParams({ chain: String(chain), address, contract });
  return fetchJson<FunctionInfo[]>(`${API_URL}/functions?${search.toString()}`);
}

export async function callFunction(params: {
  chain: number;
  address: string;
  contract: string;
  function_name: string;
  args: string[];
}): Promise<{ result?: string[]; error?: string }> {
  return fetchJson<{ result?: string[]; error?: string }>(`${API_URL}/call-function`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
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
  return fetchJson<BalanceResult[]>(`${API_URL}/balances${query ? `?${query}` : ""}`);
}

export async function fetchChains(): Promise<ChainInfo[]> {
  return fetchJson<ChainInfo[]>(`${API_URL}/chains`);
}