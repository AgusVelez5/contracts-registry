use axum::extract::{Query, State};
use axum::Json;
use futures::future::join_all;
use serde::Deserialize;
use std::collections::HashMap;
use std::sync::Arc;
use serde_json::json;
use std::time::{SystemTime, UNIX_EPOCH};

use crate::abi::{call_read_function, format_sol_value, get_readable_functions, is_selector_present};
use crate::config::Config;
use crate::identity::resolve_contract_family;
use crate::models::{
    BalanceResult, ContractInstance, DeploymentEvent,
    OnChainBytecodeIntegrityResult, ParamInfo, FunctionInfo,
    ChainInfo, ProxyInfo, VerifiedAgainst
};
use crate::pagination::{Paginated, paginate};
use crate::parsing::{group_by_contract, load_all_instances, load_deployment_events, find_artifact_for_contract, filter_current};
use crate::verification::{check_onchain_bytecode_integrity, IntegrityOutcome};
use crate::errors::AppError;
use crate::cache::IntegrityCache;
use crate::proxy::{resolve_proxy_info, get_or_resolve_proxy_info};

#[derive(Deserialize)]
pub struct InstancesQuery {
    pub contract: Option<String>,
    pub chains: Option<String>,
    pub page: Option<usize>,
    pub page_size: Option<usize>,
    #[serde(default)]
    pub exclude_current: bool,
    #[serde(default)]
    pub exact: bool,
}

const DEFAULT_INSTANCES_PAGE_SIZE: usize = 1000;

pub async fn get_instances_handler(
    State(config): State<Arc<Config>>,
    Query(query): Query<InstancesQuery>,
) -> Result<Json<Paginated<ContractInstance>>, AppError> {
    let mut instances = load_all_instances(&config.broadcast_path, &config.out_path)?;

    if let Some(contract) = &query.contract {
        let needles: Vec<String> = contract.split(',').map(|s| s.trim().to_lowercase()).collect();
        if query.exact {
            instances.retain(|i| needles.contains(&i.contract_name.to_lowercase()));
        } else {
            instances.retain(|i| {
                let name_lower = i.contract_name.to_lowercase();
                needles.iter().any(|n| name_lower.contains(n))
            });
        }
    }

    if query.exclude_current {
        let current = filter_current(instances.clone());
        let current_keys: std::collections::HashSet<(u64, String)> = current
            .into_iter()
            .map(|i| (i.chain, i.address.to_lowercase()))
            .collect();
        instances.retain(|i| !current_keys.contains(&(i.chain, i.address.to_lowercase())));
    }

    let mut available_chains: Vec<u64> = instances.iter().map(|i| i.chain).collect();
    available_chains.sort_unstable();
    available_chains.dedup();

    if let Some(chains_str) = &query.chains {
        let chain_ids: Vec<u64> = chains_str.split(',').filter_map(|s| s.parse().ok()).collect();
        if !chain_ids.is_empty() {
            instances.retain(|i| chain_ids.contains(&i.chain));
        }
    }

    instances.sort_by(|a, b| b.timestamp.cmp(&a.timestamp));

    let page = query.page.unwrap_or(1);
    let page_size = query.page_size.unwrap_or(DEFAULT_INSTANCES_PAGE_SIZE);
    let (items, total) = paginate(instances, page, page_size);

    Ok(Json(Paginated {
        items,
        total,
        page: page.max(1),
        page_size: page_size.max(1),
        available_chains,
    }))
}

#[derive(Deserialize, Default)]
pub struct IntegrityCheckQuery {
    pub chain: Option<u64>,
    pub address: Option<String>,
}

pub async fn integrity_check_handler(
    State(config): State<Arc<Config>>,
    State(cache): State<Arc<IntegrityCache>>,
    Query(query): Query<IntegrityCheckQuery>,
) -> Result<Json<HashMap<String, Vec<OnChainBytecodeIntegrityResult>>>, AppError> {
    let instances = load_all_instances(&config.broadcast_path, &config.out_path)?;
    let mut current = filter_current(instances);

    let is_targeted_recheck = query.chain.is_some() || query.address.is_some();

    if let Some(chain) = query.chain {
        current.retain(|i| i.chain == chain);
    }
    if let Some(address) = &query.address {
        current.retain(|i| i.address.eq_ignore_ascii_case(address));
    }

    let by_contract = group_by_contract(current);
    let mut all_results: Vec<OnChainBytecodeIntegrityResult> = Vec::new();

    for (contract_name, instances) in by_contract {
        for instance in &instances {
            let cached = cache.get(instance.chain, &instance.address);

            let result = match &cached {
                Some(entry) if !is_targeted_recheck && !IntegrityCache::is_stale(entry) => {
                    OnChainBytecodeIntegrityResult {
                        contract_name: entry.contract_name.clone(),
                        address: instance.address.clone(),
                        chain: instance.chain,
                        matches: entry.matches,
                        reason: entry.reason.clone(),
                        verified_against: entry.verified_against.clone(),
                        verified_at: entry.verified_at,
                    }
                }
                _ => {
                    let rpc_url = config.rpc_url(instance.chain);

                    // Check whether this address is a proxy. If it is, and the
                    // implementation is a known instance in this project,
                    // verify against the implementation's own bytecode/artifact
                    // instead of the proxy's — the proxy's bytecode never
                    // changes and comparing against it would tell us nothing
                    // useful about the logic that actually matters.
                    // A failure to determine proxy status here is treated as
                    // "not a proxy" for this specific fallback path — the
                    // dedicated /proxy-info endpoint is the source of truth
                    // for surfacing that failure explicitly to the user.
                    let proxy_info = match rpc_url {
                        Some(url) => resolve_proxy_info(&config, instance.chain, &instance.address, url)
                            .await
                            .ok(),
                        None => None,
                    };

                    let (target_contract_name, target_address, verified_against) = match &proxy_info {
                        Some(info) if info.is_proxy && info.implementation_contract_name.is_some() => {
                            let impl_name = info.implementation_contract_name.clone().unwrap();
                            let impl_addr = info.implementation_address.clone().unwrap();
                            (
                                impl_name.clone(),
                                impl_addr.clone(),
                                Some(VerifiedAgainst {
                                    contract_name: impl_name,
                                    address: impl_addr,
                                }),
                            )
                        }
                        Some(info) if info.is_proxy => {
                            // It's a proxy, but the implementation isn't tracked
                            // as a known instance in this project — we have no
                            // artifact to compare against. Fail visibly.
                            let impl_addr = info.implementation_address.clone().unwrap_or_default();
                            let fresh = OnChainBytecodeIntegrityResult {
                                contract_name: contract_name.clone(),
                                address: instance.address.clone(),
                                chain: instance.chain,
                                matches: None,
                                reason: Some(format!(
                                    "Detected as a proxy delegating to {impl_addr}, which isn't tracked as a deployed contract in this project — can't verify its bytecode locally."
                                )),
                                verified_against: None,
                                verified_at: SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_millis() as u64,
                            };
                            cache.put(instance.chain, &instance.address, &fresh);
                            all_results.push(fresh);
                            continue;
                        }
                        _ => (contract_name.clone(), instance.address.clone(), None),
                    };

                    let (artifact, _path) = find_artifact_for_contract(&config.out_path, &target_contract_name)?;

                    // Build a lightweight instance reference pointing at the
                    // verification target (proxy's own address if not a proxy,
                    // implementation's address if it is) so the existing
                    // verification logic doesn't need to know about proxies at all.
                    let mut target_instance = instance.clone();
                    target_instance.address = target_address;

                    let (outcome, verified_at) =
                        check_onchain_bytecode_integrity(&target_instance, &artifact, rpc_url).await;

                    let (matches, reason) = match &outcome {
                        IntegrityOutcome::Matches => (Some(true), None),
                        IntegrityOutcome::Mismatches => (Some(false), None),
                        IntegrityOutcome::NotSupported(msg) => (None, Some(msg.clone())),
                        IntegrityOutcome::Failed(msg) => (None, Some(msg.clone())),
                    };

                    let fresh = OnChainBytecodeIntegrityResult {
                        contract_name: contract_name.clone(),
                        address: instance.address.clone(),
                        chain: instance.chain,
                        matches,
                        reason,
                        verified_against,
                        verified_at,
                    };

                    if !matches!(outcome, IntegrityOutcome::Failed(_)) {
                        cache.put(instance.chain, &instance.address, &fresh);
                    }

                    fresh
                }
            };

            all_results.push(result);
        }
    }

    let grouped = group_by_contract(all_results);
    Ok(Json(grouped))
}

async fn get_balance_for_instance(instance: &ContractInstance, config: &Config) -> BalanceResult {
    match config.rpc_url(instance.chain) {
        Some(rpc_url) => match crate::rpc::get_balance(rpc_url, &instance.address).await {
            Ok(balance_wei) => BalanceResult {
                address: instance.address.clone(),
                chain: instance.chain,
                balance_wei: Some(balance_wei),
                error: None,
            },
            Err(e) => BalanceResult {
                address: instance.address.clone(),
                chain: instance.chain,
                balance_wei: None,
                error: Some(format!("RPC request failed: {e}")),
            },
        },
        None => BalanceResult {
            address: instance.address.clone(),
            chain: instance.chain,
            balance_wei: None,
            error: Some(format!("No RPC configured for chain {}", instance.chain)),
        },
    }
}

#[derive(Deserialize)]
pub struct BalancesQuery {
    pub chain: Option<String>,
    pub contract: Option<String>,
    pub address: Option<String>,
    #[serde(default = "default_true")]
    pub current_only: bool,
}

fn default_true() -> bool {
    true
}

pub async fn balances_handler(
    State(config): State<Arc<Config>>,
    Query(query): Query<BalancesQuery>,
) -> Result<Json<Vec<BalanceResult>>, AppError> {
    let mut instances = load_all_instances(&config.broadcast_path, &config.out_path)?;

    if query.current_only {
        instances = filter_current(instances);
    }

    if let Some(contract) = &query.contract {
        instances.retain(|i| i.contract_name.to_lowercase().contains(&contract.to_lowercase()));
    }

    if let Some(chains_str) = &query.chain {
        let chain_ids: Vec<u64> = chains_str.split(',').filter_map(|s| s.parse().ok()).collect();
        if !chain_ids.is_empty() {
            instances.retain(|i| chain_ids.contains(&i.chain));
        }
    }

    if let Some(address) = &query.address {
        instances.retain(|i| i.address.eq_ignore_ascii_case(address));
    }

    let balance_futures = instances.iter().map(|i| get_balance_for_instance(i, &config));
    let results: Vec<BalanceResult> = join_all(balance_futures).await;

    Ok(Json(results))
}

#[derive(Deserialize)]
pub struct DeploymentEventsQuery {
    pub page: Option<usize>,
    pub page_size: Option<usize>,
    pub chains: Option<String>,
    pub contract: Option<String>,
    pub tx_hash: Option<String>,
    #[serde(default)]
    pub exact: bool,
}

pub async fn deployment_events_handler(
    State(config): State<Arc<Config>>,
    Query(query): Query<DeploymentEventsQuery>,
) -> Result<Json<Paginated<DeploymentEvent>>, AppError> {
    let mut events = load_deployment_events(&config.broadcast_path)?;

    if let Some(contract) = &query.contract {
        let needles: Vec<String> = contract.split(',').map(|s| s.trim().to_lowercase()).collect();
        if query.exact {
            events.retain(|e| needles.contains(&e.contract_name.to_lowercase()));
        } else {
            events.retain(|e| {
                let name_lower = e.contract_name.to_lowercase();
                needles.iter().any(|n| name_lower.contains(n))
            });
        }
    }

    if let Some(tx_hash) = &query.tx_hash {
        events.retain(|e| e.tx_hash.eq_ignore_ascii_case(tx_hash));
    }

    let mut available_chains: Vec<u64> = events.iter().map(|e| e.chain).collect();
    available_chains.sort_unstable();
    available_chains.dedup();

    if let Some(chains_str) = &query.chains {
        let chain_ids: Vec<u64> = chains_str.split(',').filter_map(|s| s.parse().ok()).collect();
        if !chain_ids.is_empty() {
            events.retain(|e| chain_ids.contains(&e.chain));
        }
    }

    let page = query.page.unwrap_or(1);
    let page_size = query.page_size.unwrap_or(25);
    let (items, total) = paginate(events, page, page_size);

    Ok(Json(Paginated {
        items,
        total,
        page: page.max(1),
        page_size: page_size.max(1),
        available_chains,
    }))
}

#[derive(Deserialize)]
pub struct BuildFreshnessQuery {
    pub contract: String,
}

pub async fn build_freshness_handler(
    State(config): State<Arc<Config>>,
    Query(query): Query<BuildFreshnessQuery>,
) -> Result<Json<serde_json::Value>, AppError> {
    let (artifact, artifact_path) = find_artifact_for_contract(&config.out_path, &query.contract)?;
    let stale = crate::freshness::source_modified_since_build(&artifact, &artifact_path, ".")?;
    Ok(Json(serde_json::json!({ "stale": stale })))
}

pub async fn recompile_handler() -> Result<Json<serde_json::Value>, AppError> {
    let (success, log) = crate::compiler::run_forge_build(".")
        .await
        .map_err(|e| AppError::Internal(format!("Failed to run forge build: {e}")))?;

    Ok(Json(serde_json::json!({ "success": success, "log": log })))
}

#[derive(Deserialize)]
pub struct FunctionsQuery {
    pub chain: u64,
    pub address: String,
    pub contract: String,
}

pub async fn functions_handler(
    State(config): State<Arc<Config>>,
    State(cache): State<Arc<IntegrityCache>>,
    Query(query): Query<FunctionsQuery>,
) -> Result<Json<Vec<FunctionInfo>>, AppError> {
    let (artifact, _path) = find_artifact_for_contract(&config.out_path, &query.contract)?;

    let functions = get_readable_functions(&artifact.abi);

    // The address the state lives at (query.address, possibly a proxy) is
    // different from the address whose bytecode actually contains the
    // function selectors — if it's a proxy, that's the implementation's
    // address, not the proxy's own.
    let bytecode_check_address = match config.rpc_url(query.chain) {
        Some(_) => {
            let proxy_info = get_or_resolve_proxy_info(&config, &cache, query.chain, &query.address).await;
            match proxy_info.implementation_address {
                Some(impl_addr) if proxy_info.is_proxy => impl_addr,
                _ => query.address.clone(),
            }
        }
        None => query.address.clone(),
    };

    let deployed_bytecode = match config.rpc_url(query.chain) {
        Some(rpc_url) => crate::rpc::get_deployed_code(rpc_url, &bytecode_check_address).await.ok(),
        None => None,
    };

    let result: Vec<FunctionInfo> = functions
        .iter()
        .map(|f| {
            let present = match &deployed_bytecode {
                Some(bytecode) => is_selector_present(bytecode, &f.selector()),
                None => true,
            };

            FunctionInfo {
                name: f.name.clone(),
                inputs: f.inputs.iter().map(|p| ParamInfo { name: p.name.clone(), param_type: p.ty.clone() }).collect(),
                outputs: f.outputs.iter().map(|p| ParamInfo { name: p.name.clone(), param_type: p.ty.clone() }).collect(),
                present,
            }
        })
        .collect();

    Ok(Json(result))
}

#[derive(Deserialize)]
pub struct CallFunctionRequest {
    pub chain: u64,
    pub address: String,
    pub contract: String,
    pub function_name: String,
    pub args: Vec<String>,
}

pub async fn call_function_handler(
    State(config): State<Arc<Config>>,
    axum::Json(payload): axum::Json<CallFunctionRequest>,
) -> Result<Json<serde_json::Value>, AppError> {
    let (artifact, _path) = find_artifact_for_contract(&config.out_path, &payload.contract)?;

    let function = artifact
        .abi
        .function(&payload.function_name)
        .and_then(|fns| fns.first())
        .ok_or_else(|| AppError::NotFound(format!("Function '{}' not found", payload.function_name)))?;

    let rpc_url = config.rpc_url(payload.chain)
        .ok_or_else(|| AppError::BadRequest(format!("No RPC configured for chain {}", payload.chain)))?;

    let values = call_read_function(rpc_url, &payload.address, function, &payload.args)
        .await
        .map_err(|e| AppError::BadRequest(e.to_string()))?;

    let as_strings: Vec<String> = values.iter().map(format_sol_value).collect();
    Ok(Json(json!({ "result": as_strings })))
}

pub async fn chains_handler(
    State(config): State<Arc<Config>>,
) -> Json<Vec<ChainInfo>> {
    let chains = config
        .chains
        .iter()
        .map(|(chain, chain_config)| ChainInfo {
            chain: *chain,
            explorer_url: chain_config.explorer_url.clone(),
        })
        .collect();

    Json(chains)
}

#[derive(Deserialize, Default)]
pub struct ProxyInfoQuery {
    pub chain: Option<u64>,
    pub address: Option<String>,
}

pub async fn proxy_info_handler(
    State(config): State<Arc<Config>>,
    State(cache): State<Arc<IntegrityCache>>,
    Query(query): Query<ProxyInfoQuery>,
) -> Result<Json<HashMap<String, ProxyInfo>>, AppError> {
    let instances = load_all_instances(&config.broadcast_path, &config.out_path)?;
    let mut current = filter_current(instances);

    if let Some(chain) = query.chain {
        current.retain(|i| i.chain == chain);
    }
    if let Some(address) = &query.address {
        current.retain(|i| i.address.eq_ignore_ascii_case(address));
    }

    let mut results: HashMap<String, ProxyInfo> = HashMap::new();

    for instance in &current {
        let key = format!("{}:{}", instance.chain, instance.address);
        let proxy_info = get_or_resolve_proxy_info(&config, &cache, instance.chain, &instance.address).await;
        results.insert(key, proxy_info);
    }

    Ok(Json(results))
}

#[derive(Deserialize)]
pub struct ContractFamilyQuery {
    pub name: String,
}

pub async fn contract_family_handler(
    State(config): State<Arc<Config>>,
    State(cache): State<Arc<IntegrityCache>>,
    Query(query): Query<ContractFamilyQuery>,
) -> Result<Json<Vec<String>>, AppError> {
    let family = resolve_contract_family(&config, &cache, &query.name).await?;
    Ok(Json(family))
}