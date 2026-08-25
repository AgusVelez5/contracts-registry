import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  fetchInstances,
  fetchIntegrityCheck,
  fetchBalances,
  fetchDeploymentEvents,
  fetchBuildFreshness,
  recompile,
  fetchFunctions,
  fetchChains,
} from "./api";
import type { IntegrityCheckResponse } from "./types";

export function useInstances(params?: {
  contract?: string;
  chains?: number[];
  page?: number;
  pageSize?: number;
  excludeCurrent?: boolean;
}) {
  return useQuery({
    queryKey: [
      "instances",
      params?.contract,
      params?.chains?.join(","),
      params?.page,
      params?.pageSize,
      params?.excludeCurrent,
    ],
    queryFn: () => fetchInstances(params),
  });
}

export function useBalances(params?: {
  contract?: string;
  chains?: number[];
  currentOnly?: boolean;
  address?: string;
}) {
  return useQuery({
    queryKey: [
      "balances",
      params?.contract,
      params?.chains?.join(","),
      params?.currentOnly,
      params?.address,
    ],
    queryFn: () => fetchBalances(params),
  });
}

export function useIntegrityCheck() {
  return useQuery({
    queryKey: ["integrity-check"],
    queryFn: () => fetchIntegrityCheck(),
  });
}

export function useIntegrityCheckMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => fetchIntegrityCheck(),
    onSuccess: (data) => {
      queryClient.setQueryData(["integrity-check"], data);
    },
  });
}

export function useRecheckInstanceMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (params: { chain: number; address: string }) => fetchIntegrityCheck(params),
    onSuccess: (data) => {
      queryClient.setQueryData(["integrity-check"], (prev: IntegrityCheckResponse | undefined) => {
        const merged = { ...(prev ?? {}) };
        for (const [contractName, results] of Object.entries(data)) {
          const existing = merged[contractName] ?? [];
          const filtered = existing.filter(
            (r) => !results.some((newR) => newR.chain === r.chain && newR.address === r.address)
          );
          merged[contractName] = [...filtered, ...results];
        }
        return merged;
      });
    },
  });
}

export function useDeploymentEvents(params: {
  page: number;
  pageSize: number;
  contract?: string;
  chains?: number[];
}) {
  return useQuery({
    queryKey: ["deployment-events", params.page, params.pageSize, params.contract, params.chains?.join(",")],
    queryFn: () => fetchDeploymentEvents(params),
  });
}

export function useBuildFreshness(contract: string) {
  return useQuery({
    queryKey: ["build-freshness", contract],
    queryFn: () => fetchBuildFreshness(contract),
    enabled: !!contract,
  });
}

export function useRecompileMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: recompile,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["build-freshness"] });
    },
  });
}

export function useFunctions(chain: number, address: string, contract: string) {
  return useQuery({
    queryKey: ["functions", chain, address, contract],
    queryFn: () => fetchFunctions(chain, address, contract),
    enabled: !!address && !!contract,
  });
}

export function useChains() {
  return useQuery({
    queryKey: ["chains"],
    queryFn: fetchChains,
    staleTime: Infinity,
  });
}