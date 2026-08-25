use crate::models::{ContractArtifact, ContractInstance, OnChainBytecodeIntegrityResult};
use crate::rpc::{get_deployed_code};
use std::time::{SystemTime, UNIX_EPOCH};

pub fn verify_bytecode(deployed_on_chain: &str, compiled: &str) -> bool {
    deployed_on_chain == compiled
}

pub async fn check_onchain_bytecode_integrity(
    instance: &ContractInstance,
    artifact: &ContractArtifact,
    rpc_url: Option<&str>,
) -> OnChainBytecodeIntegrityResult {
    let matches = match rpc_url {
        Some(rpc_url) => {
            match get_deployed_code(rpc_url, &instance.address).await {
                Ok(code) => verify_bytecode(&code, &artifact.deployed_bytecode.object),
                Err(_) => false,
            }
        }
        None => false,
    };

    let verified_at = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .as_millis() as u64;

    OnChainBytecodeIntegrityResult {
        contract_name: instance.contract_name.clone(),
        address: instance.address.clone(),
        chain: instance.chain,
        matches,
        verified_at,
    }
}