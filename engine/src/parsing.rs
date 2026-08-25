use crate::errors::AppError;
use crate::models::{BroadcastFile, ContractArtifact, ContractInstance, DeploymentEvent, HasContractName};
use std::collections::{HashMap, HashSet};

pub fn parse_json_file<T: serde::de::DeserializeOwned>(
    file_path: &str,
) -> Result<T, Box<dyn std::error::Error>> {
    let content = std::fs::read_to_string(file_path)?;
    let data = serde_json::from_str(&content)?;
    Ok(data)
}

pub fn find_scripts(broadcast_path: &str) -> Result<Vec<String>, AppError> {
    let entries = std::fs::read_dir(broadcast_path)
        .map_err(|e| AppError::Internal(format!("Failed to read broadcast directory '{broadcast_path}': {e}")))?;

    let folders = entries
        .filter_map(|entry| entry.ok())
        .filter(|entry| entry.path().is_dir())
        .map(|entry| entry.path().to_string_lossy().to_string())
        .collect();

    Ok(folders)
}

pub fn find_chain_folders(script_folder: &str) -> Result<Vec<String>, Box<dyn std::error::Error>> {
    let entries = std::fs::read_dir(script_folder)?;

    let folders = entries
        .filter_map(|entry| entry.ok())
        .filter(|entry| entry.path().is_dir())
        .map(|entry| entry.path().to_string_lossy().to_string())
        .collect();

    Ok(folders)
}

pub fn find_run_files(chain_folder: &str) -> Result<Vec<String>, Box<dyn std::error::Error>> {
    let entries = std::fs::read_dir(chain_folder)?;

    let files = entries
        .filter_map(|entry| entry.ok())
        .filter(|entry| {
            let name = entry.file_name().to_string_lossy().to_string();
            name.starts_with("run-") && name.ends_with(".json")
        })
        .map(|entry| entry.path().to_string_lossy().to_string())
        .collect();

    Ok(files)
}

/// Recursively finds all `<contract_name>.json` files under `out_path`,
/// skipping the `build-info` directory (which holds compiler metadata, not artifacts).
fn find_artifact_files(out_path: &str, contract_name: &str) -> Result<Vec<String>, AppError> {
    let mut matches = Vec::new();
    walk_for_artifact(out_path, contract_name, &mut matches)?;
    Ok(matches)
}

fn walk_for_artifact(dir: &str, contract_name: &str, matches: &mut Vec<String>) -> Result<(), AppError> {
    let entries = std::fs::read_dir(dir)
        .map_err(|e| AppError::Internal(format!("Failed to read '{dir}': {e}")))?;

    for entry in entries.filter_map(|e| e.ok()) {
        let path = entry.path();
        let file_name = entry.file_name().to_string_lossy().to_string();

        if path.is_dir() {
            if file_name == "build-info" {
                continue;
            }
            walk_for_artifact(&path.to_string_lossy(), contract_name, matches)?;
        } else if file_name == format!("{contract_name}.json") {
            matches.push(path.to_string_lossy().to_string());
        }
    }

    Ok(())
}

pub fn find_artifact_for_contract(out_path: &str, contract_name: &str) -> Result<(ContractArtifact, String), AppError> {
    let matches = find_artifact_files(out_path, contract_name)?;

    match matches.as_slice() {
        [] => Err(AppError::NotFound(format!(
            "No artifact found for contract '{contract_name}' under '{out_path}'. Has it been compiled?"
        ))),
        [single] => {
            let artifact = parse_json_file(single)
                .map_err(|e| AppError::Internal(format!("Failed to parse artifact '{single}': {e}")))?;
            Ok((artifact, single.clone()))
        }
        multiple => Err(AppError::Conflict(format!(
            "Contract name '{contract_name}' is ambiguous: found in {}. Rename one of the contracts to resolve this.",
            multiple.join(", ")
        ))),
    }
}

pub fn load_all_instances(broadcast_path: &str, out_path: &str) -> Result<Vec<ContractInstance>, AppError> {
    let scripts = find_scripts(broadcast_path)?;

    let mut seen: HashSet<(u64, String)> = HashSet::new();
    let mut instances: Vec<ContractInstance> = Vec::new();
    let mut artifact_cache: HashMap<String, ContractArtifact> = HashMap::new();

    for script_folder in scripts {
        let chain_folders = find_chain_folders(&script_folder)
            .map_err(|e| AppError::Internal(format!("Failed to read '{script_folder}': {e}")))?;

        for folder in chain_folders {
            let run_files = find_run_files(&folder)
                .map_err(|e| AppError::Internal(format!("Failed to read '{folder}': {e}")))?;

            for file_path in run_files {
                let broadcast_data: BroadcastFile = parse_json_file(&file_path)
                    .map_err(|e| AppError::Internal(format!("Failed to parse '{file_path}': {e}")))?;

                for tx in broadcast_data.transactions.iter().filter(|tx| tx.tx_type == "CREATE") {
                    let receipt = broadcast_data.receipts.iter().find(|r| r.transaction_hash == tx.hash);

                    let succeeded = receipt.map(|r| r.status == "0x1").unwrap_or(false);
                    if !succeeded {
                        continue;
                    }

                    let contract_name = match &tx.contract_name {
                        Some(name) if !name.is_empty() => name.clone(),
                        _ => {
                            eprintln!("Warning: skipping deployment in '{file_path}' with missing contract name");
                            continue;
                        }
                    };

                    let key = (broadcast_data.chain, tx.address.clone());
                    if seen.contains(&key) {
                        continue;
                    }
                    seen.insert(key);

                    if !artifact_cache.contains_key(&contract_name) {
                        let (artifact, _) = find_artifact_for_contract(out_path, &contract_name)?;
                        artifact_cache.insert(contract_name.clone(), artifact);
                    }
                    let artifact = artifact_cache.get(&contract_name).unwrap();
                    let constructor_params = crate::abi::get_constructor_params(&artifact.abi);

                    instances.push(ContractInstance {
                        contract_name,
                        address: tx.address.clone(),
                        chain: broadcast_data.chain,
                        timestamp: broadcast_data.timestamp,
                        constructor_args: tx.arguments.clone(),
                        constructor_params,
                    });
                }
            }
        }
    }

    instances.sort_by(|a, b| b.timestamp.cmp(&a.timestamp));
    Ok(instances)
}

pub fn load_deployment_events(broadcast_path: &str) -> Result<Vec<DeploymentEvent>, AppError> {
    let scripts = find_scripts(broadcast_path)?;

    let mut seen_hashes: HashSet<String> = HashSet::new();
    let mut events: Vec<DeploymentEvent> = Vec::new();

    for script_folder in scripts {
        let chain_folders = find_chain_folders(&script_folder)
            .map_err(|e| AppError::Internal(format!("Failed to read '{script_folder}': {e}")))?;

        for folder in chain_folders {
            let run_files = find_run_files(&folder)
                .map_err(|e| AppError::Internal(format!("Failed to read '{folder}': {e}")))?;

            for file_path in run_files {
                let broadcast_data: BroadcastFile = parse_json_file(&file_path)
                    .map_err(|e| AppError::Internal(format!("Failed to parse '{file_path}': {e}")))?;

                for tx in broadcast_data.transactions.iter().filter(|tx| tx.tx_type == "CREATE") {
                    if seen_hashes.contains(&tx.hash) {
                        continue;
                    }
                    seen_hashes.insert(tx.hash.clone());

                    let receipt = broadcast_data.receipts.iter().find(|r| r.transaction_hash == tx.hash);

                    events.push(DeploymentEvent {
                        tx_hash: tx.hash.clone(),
                        contract_name: tx.contract_name.clone().unwrap_or_default(),
                        address: tx.address.clone(),
                        chain: broadcast_data.chain,
                        timestamp: broadcast_data.timestamp,
                        gas_used: receipt.map(|r| r.gas_used.clone()),
                        effective_gas_price: receipt.map(|r| r.effective_gas_price.clone()),
                        constructor_args: tx.arguments.clone(),
                        status: receipt.map(|r| r.status.clone()),
                    });
                }
            }
        }
    }

    events.sort_by(|a, b| b.timestamp.cmp(&a.timestamp));
    Ok(events)
}

pub fn group_by_contract<T: HasContractName>(items: Vec<T>) -> HashMap<String, Vec<T>> {
    let mut grouped: HashMap<String, Vec<T>> = HashMap::new();

    for item in items {
        grouped
            .entry(item.contract_name().to_string())
            .or_insert_with(Vec::new)
            .push(item);
    }

    grouped
}

pub fn filter_current(instances: Vec<ContractInstance>) -> Vec<ContractInstance> {
    let mut latest: HashMap<(String, u64), ContractInstance> = HashMap::new();

    for instance in instances {
        let key = (instance.contract_name.clone(), instance.chain);
        match latest.get(&key) {
            Some(existing) if existing.timestamp >= instance.timestamp => {}
            _ => { latest.insert(key, instance); }
        }
    }

    latest.into_values().collect()
}