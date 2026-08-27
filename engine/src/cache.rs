use crate::models::OnChainBytecodeIntegrityResult;
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
    pub verified_at: u64,
}

#[derive(Debug, Default, Serialize, Deserialize)]
struct CacheFile {
    integrity_results: HashMap<String, CachedIntegrityResult>,
}

pub struct IntegrityCache {
    inner: Mutex<CacheFile>,
}

fn cache_key(chain: u64, address: &str) -> String {
    format!("{chain}:{}", address.to_lowercase())
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
        let now = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_millis() as u64;
        now.saturating_sub(entry.verified_at) > STALE_THRESHOLD_MS
    }

    pub fn put(&self, chain: u64, address: &str, result: &OnChainBytecodeIntegrityResult) {
        let mut cache = self.inner.lock().unwrap();
        cache.integrity_results.insert(
            cache_key(chain, address),
            CachedIntegrityResult {
                contract_name: result.contract_name.clone(),
                matches: result.matches,
                reason: result.reason.clone(),
                verified_at: result.verified_at,
            },
        );

        if let Ok(json) = serde_json::to_string_pretty(&*cache) {
            let _ = std::fs::write(CACHE_FILENAME, json);
        }
    }
}