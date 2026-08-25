import type { ContractInstance } from "./types";

export function getCurrentInstances(instances: ContractInstance[]): ContractInstance[] {
  const latest = new Map<string, ContractInstance>();

  for (const instance of instances) {
    const key = `${instance.contract_name}::${instance.chain}`;
    const existing = latest.get(key);
    if (!existing || instance.timestamp > existing.timestamp) {
      latest.set(key, instance);
    }
  }

  return Array.from(latest.values());
}