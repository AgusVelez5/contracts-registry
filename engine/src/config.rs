use crate::errors::AppError;
use serde::Deserialize;
use std::collections::HashMap;

#[derive(Debug, Deserialize, Clone)]
pub struct ChainConfig {
    pub rpc_url: String,
    pub explorer_url: Option<String>,
}

#[derive(Debug, Deserialize, Clone)]
pub struct Config {
    pub broadcast_path: String,
    pub out_path: String,
    pub chains: HashMap<u64, ChainConfig>,
    pub port: Option<u16>,
}

const CONFIG_FILENAME: &str = "registry.config.json";

impl Config {
    pub fn load_from_cwd() -> Result<Self, AppError> {
        let content = std::fs::read_to_string(CONFIG_FILENAME).map_err(|e| {
            AppError::Internal(format!(
                "Could not find or read '{CONFIG_FILENAME}' in the current directory: {e}\n\
                 Run this command from the root of your Foundry project, with a {CONFIG_FILENAME} file present."
            ))
        })?;

        let config: Config = serde_json::from_str(&content)
            .map_err(|e| AppError::Internal(format!("Failed to parse '{CONFIG_FILENAME}': {e}")))?;

        Ok(config)
    }

    pub fn rpc_url(&self, chain: u64) -> Option<&str> {
        self.chains.get(&chain).map(|c| c.rpc_url.as_str())
    }

    pub fn explorer_url(&self, chain: u64) -> Option<&str> {
        self.chains.get(&chain).and_then(|c| c.explorer_url.as_deref())
    }
}