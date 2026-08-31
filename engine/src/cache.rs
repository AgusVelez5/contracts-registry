use crate::models::{OnChainBytecodeIntegrityResult, VerifiedAgainst};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Mutex;
use std::time::{SystemTime, UNIX_EPOCH};

const CACHE_FILENAME: &str = ".registry-cache.json";
const STALE_THRESHOLD_MS: u64 = 24 * 60 * 60 * 1000; // 24 hours

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CachedIntegrityResult {
    pub contract_name: String,
    pub matches: Option<bool>,
    pub reason: Option<String>,
    pub verified_against: Option<VerifiedAgainst>,
    pub verified_at: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CachedProxyInfo {
    pub is_proxy: bool,
    pub implementation_address: Option<String>,
    pub implementation_contract_name: Option<String>,
    pub error: Option<String>,
    pub implementation_verified_at: u64,
}

#[derive(Debug, Default, Serialize, Deserialize)]
struct CacheFile {
    integrity_results: HashMap<String, CachedIntegrityResult>,
    #[serde(default)]
    proxy_info: HashMap<String, CachedProxyInfo>,
}

pub struct IntegrityCache {
    inner: Mutex<CacheFile>,
}

fn cache_key(chain: u64, address: &str) -> String {
    format!("{chain}:{}", address.to_lowercase())
}

fn is_stale_at(verified_at: u64) -> bool {
    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .as_millis() as u64;
    now.saturating_sub(verified_at) > STALE_THRESHOLD_MS
}

impl IntegrityCache {
    /// Loads the cache file if present and valid; treats a missing OR corrupt
    /// file as "start empty" — never fails startup over a bad cache file.
    pub fn load() -> Self {
        let loaded: CacheFile = std::fs::read_to_string(CACHE_FILENAME)
            .ok()
            .and_then(|content| serde_json::from_str(&content).ok())
            .unwrap_or_default();

        IntegrityCache { inner: Mutex::new(loaded) }
    }

    pub fn get(&self, chain: u64, address: &str) -> Option<CachedIntegrityResult> {
        let cache = self.inner.lock().unwrap();
        cache.integrity_results.get(&cache_key(chain, address)).cloned()
    }

    pub fn is_stale(entry: &CachedIntegrityResult) -> bool {
        is_stale_at(entry.verified_at)
    }

    pub fn put(&self, chain: u64, address: &str, result: &OnChainBytecodeIntegrityResult) {
        let mut cache = self.inner.lock().unwrap();
        cache.integrity_results.insert(
            cache_key(chain, address),
            CachedIntegrityResult {
                contract_name: result.contract_name.clone(),
                matches: result.matches,
                reason: result.reason.clone(),
                verified_against: result.verified_against.clone(),
                verified_at: result.verified_at,
            },
        );

        if let Ok(json) = serde_json::to_string_pretty(&*cache) {
            let _ = std::fs::write(CACHE_FILENAME, json);
        }
    }

    pub fn get_proxy_info(&self, chain: u64, address: &str) -> Option<CachedProxyInfo> {
        let cache = self.inner.lock().unwrap();
        cache.proxy_info.get(&cache_key(chain, address)).cloned()
    }

    /// Whether the *implementation address* needs rechecking. Never true for
    /// a confirmed non-proxy — that fact is permanent.
    pub fn is_proxy_info_stale(entry: &CachedProxyInfo) -> bool {
        entry.error.is_some() || (entry.is_proxy && is_stale_at(entry.implementation_verified_at))
    }

  pub fn put_proxy_info(&self, chain: u64, address: &str, info: &CachedProxyInfo) {
      if info.error.is_some() {
          return; // transient failures aren't persisted, same policy as integrity results
      }

      let mut cache = self.inner.lock().unwrap();
      cache.proxy_info.insert(cache_key(chain, address), info.clone());

      if let Ok(json) = serde_json::to_string_pretty(&*cache) {
          let _ = std::fs::write(CACHE_FILENAME, json);
      }
  }
}