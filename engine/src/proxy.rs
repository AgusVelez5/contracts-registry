use crate::rpc::{eth_call, get_storage_at};
use sha3::{Digest, Keccak256};
use crate::config::Config;
use crate::errors::AppError;
use crate::models::ProxyInfo;
use crate::parsing::load_all_instances;
use crate::cache::{CachedProxyInfo, IntegrityCache};
use std::time::{SystemTime, UNIX_EPOCH};

// EIP-1967 implementation slot: bytes32(uint256(keccak256('eip1967.proxy.implementation')) - 1)
const EIP1967_IMPLEMENTATION_SLOT: &str =
    "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc";

// EIP-1967 beacon slot: bytes32(uint256(keccak256('eip1967.proxy.beacon')) - 1)
const EIP1967_BEACON_SLOT: &str =
    "0xa3f0ad74e5423aebfd80d3ef4346578335a9a72aeaee59ff6cb3582b35133d50";

// Standard `implementation()` view function selector — used by both EIP-1967
// beacon contracts and several other proxy conventions.
const IMPLEMENTATION_SELECTOR: &str = "0x5c60da1b";

/// Legacy pre-EIP-1967 OpenZeppelin SDK (zOS) slot: keccak256("org.zeppelinos.proxy.implementation")
/// Computed at runtime rather than hardcoded, since it's the direct output of a
/// hash rather than a value with independent public confirmation.
fn legacy_oz_implementation_slot() -> String {
    let mut hasher = Keccak256::new();
    hasher.update(b"org.zeppelinos.proxy.implementation");
    format!("0x{}", hex::encode(hasher.finalize()))
}

fn parse_address_from_storage(storage_hex: &str) -> Option<String> {
    let hex_body = storage_hex.trim_start_matches("0x");
    if hex_body.len() < 40 {
        return None;
    }
    let addr = &hex_body[hex_body.len() - 40..];
    if addr.chars().all(|c| c == '0') {
        return None; // empty slot
    }
    Some(format!("0x{addr}"))
}

fn parse_address_from_eth_call(result_hex: &str) -> Option<String> {
    parse_address_from_storage(result_hex)
}

/// Detects whether `address` is a proxy, and if so, resolves its implementation
/// address. Tries, in order: EIP-1967 implementation slot, the legacy
/// pre-EIP-1967 OpenZeppelin SDK slot (same fallback OpenZeppelin's own
/// upgrades tooling uses), then EIP-1967 beacon slot + a call to the beacon's
/// `implementation()` function. Returns `None` if none of these apply — not
/// every non-proxy contract, just none of the *standardized* patterns this
/// tool currently understands (see docs/SCOPE.md).
pub async fn detect_proxy_implementation(
    rpc_url: &str,
    address: &str,
) -> Result<Option<String>, Box<dyn std::error::Error + Send + Sync>> {
    if let Ok(storage) = get_storage_at(rpc_url, address, EIP1967_IMPLEMENTATION_SLOT).await {
        if let Some(impl_addr) = parse_address_from_storage(&storage) {
            return Ok(Some(impl_addr));
        }
    }

    let legacy_slot = legacy_oz_implementation_slot();
    if let Ok(storage) = get_storage_at(rpc_url, address, &legacy_slot).await {
        if let Some(impl_addr) = parse_address_from_storage(&storage) {
            return Ok(Some(impl_addr));
        }
    }

    if let Ok(storage) = get_storage_at(rpc_url, address, EIP1967_BEACON_SLOT).await {
        if let Some(beacon_addr) = parse_address_from_storage(&storage) {
            if let Ok(result) = eth_call(rpc_url, &beacon_addr, IMPLEMENTATION_SELECTOR).await {
                if let Some(impl_addr) = parse_address_from_eth_call(&result) {
                    return Ok(Some(impl_addr));
                }
            }
        }
    }

    Ok(None)
}

/// Detects whether `address` is a proxy and, if so, resolves its implementation
/// address plus (when possible) the contract_name of that implementation, by
/// cross-referencing against instances already known to this project. Never
/// guesses an artifact for an implementation this project didn't deploy itself.
pub async fn resolve_proxy_info(
    config: &Config,
    chain: u64,
    address: &str,
    rpc_url: &str,
) -> Result<ProxyInfo, AppError> {
    let implementation_address = detect_proxy_implementation(rpc_url, address)
        .await
        .map_err(|e| AppError::Internal(format!("Failed to check proxy status: {e}")))?;

    let Some(impl_addr) = implementation_address else {
        return Ok(ProxyInfo {
            is_proxy: false,
            implementation_address: None,
            implementation_contract_name: None,
            error: None,
        });
    };

    let all_instances = load_all_instances(&config.broadcast_path, &config.out_path)?;
    let matched = all_instances.iter().find(|i| {
        i.chain == chain && i.address.eq_ignore_ascii_case(&impl_addr)
    });

    Ok(ProxyInfo {
        is_proxy: true,
        implementation_address: Some(impl_addr),
        implementation_contract_name: matched.map(|i| i.contract_name.clone()),
        error: None,
    })
}

/// The single source of truth for "what's the proxy status of this instance,
/// right now" — checks the cache first (respecting its permanent/24h-staleness
/// split), resolves fresh only when needed, and persists the result. Both
/// `/proxy-info` and contract-family resolution go through this, so neither
/// duplicates the cache logic or bypasses it.
pub async fn get_or_resolve_proxy_info(
    config: &Config,
    cache: &IntegrityCache,
    chain: u64,
    address: &str,
) -> ProxyInfo {
    let cached = cache.get_proxy_info(chain, address);

    if let Some(entry) = &cached {
        if !IntegrityCache::is_proxy_info_stale(entry) {
            return ProxyInfo {
                is_proxy: entry.is_proxy,
                implementation_address: entry.implementation_address.clone(),
                implementation_contract_name: entry.implementation_contract_name.clone(),
                error: None,
            };
        }
    }

    let info = match config.rpc_url(chain) {
        None => ProxyInfo {
            is_proxy: false,
            implementation_address: None,
            implementation_contract_name: None,
            error: Some(format!("No RPC configured for chain {chain}")),
        },
        Some(rpc_url) => resolve_proxy_info(config, chain, address, rpc_url)
            .await
            .unwrap_or_else(|e| ProxyInfo {
                is_proxy: false,
                implementation_address: None,
                implementation_contract_name: None,
                error: Some(e.to_string()),
            }),
    };

    cache.put_proxy_info(
        chain,
        address,
        &CachedProxyInfo {
            is_proxy: info.is_proxy,
            implementation_address: info.implementation_address.clone(),
            implementation_contract_name: info.implementation_contract_name.clone(),
            error: info.error.clone(),
            implementation_verified_at: SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap()
                .as_millis() as u64,
        },
    );

    info
}