export interface Transaction {
  hash: string;
  tx_type: string;
  contract_name: string | null;
  address: string;
  arguments: string[] | null;
}

export interface ParamInfo {
  name: string;
  type: string;
}

export interface ContractInstance {
  contract_name: string;
  address: string;
  chain: number;
  timestamp: number;
  constructor_args: string[] | null;
  constructor_params: ParamInfo[];
}

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
  available_chains: number[];
}

export type InstancesResponse = Paginated<ContractInstance>;

export interface OnChainBytecodeIntegrityResult {
  contract_name: string;
  address: string;
  chain: number;
  matches: boolean | null;
  reason: string | null;
  verified_at: number;
}

export type IntegrityCheckResponse = Record<string, OnChainBytecodeIntegrityResult[]>;

export interface BalanceResult {
  address: string;
  chain: number;
  balance_wei: string | null;
  error: string | null;
}

export interface DeploymentEvent {
  tx_hash: string;
  contract_name: string;
  address: string;
  chain: number;
  timestamp: number;
  gas_used: string | null;
  effective_gas_price: string | null;
  constructor_args: string[] | null;
  status: string | null;
}

export type PaginatedDeploymentEventsResponse = Paginated<DeploymentEvent>;

export interface FunctionInfo {
  name: string;
  inputs: ParamInfo[];
  outputs: ParamInfo[];
  present: boolean;
}

export interface ChainInfo {
  chain: number;
  explorer_url: string | null;
}