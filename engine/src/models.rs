use alloy_json_abi::JsonAbi;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Debug, Deserialize)]
pub struct Transaction {
    pub hash: String,
    #[serde(rename = "transactionType")]
    pub tx_type: String,
    #[serde(rename = "contractName")]
    pub contract_name: Option<String>,
    #[serde(rename = "contractAddress")]
    pub address: String,
    pub arguments: Option<Vec<String>>,
}

#[derive(Debug, Deserialize)]
pub struct Receipt {
    #[serde(rename = "transactionHash")]
    pub transaction_hash: String,
    #[serde(rename = "gasUsed")]
    pub gas_used: String,
    #[serde(rename = "effectiveGasPrice")]
    pub effective_gas_price: String,
    pub status: String,
}

#[derive(Debug, Deserialize)]
pub struct BroadcastFile {
    pub transactions: Vec<Transaction>,
    pub receipts: Vec<Receipt>,
    pub chain: u64,
    pub timestamp: u64,
}

#[derive(Debug, Deserialize, Clone)]
pub struct BytecodeRange {
    pub start: usize,
    pub length: usize,
}

#[derive(Debug, Deserialize)]
pub struct DeployedBytecode {
    pub object: String,
    #[serde(rename = "immutableReferences", default)]
    pub immutable_references: HashMap<String, Vec<BytecodeRange>>,
    #[serde(rename = "linkReferences", default)]
    pub link_references: HashMap<String, HashMap<String, Vec<BytecodeRange>>>,
}

#[derive(Debug, Deserialize)]
pub struct ContractArtifact {
    #[serde(rename = "deployedBytecode")]
    pub deployed_bytecode: DeployedBytecode,
    pub abi: JsonAbi,
    pub metadata: ArtifactMetadata,
}

impl ContractArtifact {
    pub fn source_path(&self) -> Option<&str> {
        self.metadata.settings.compilation_target.keys().next().map(|s| s.as_str())
    }
}

#[derive(Debug, Clone, Serialize)]
pub struct ParamInfo {
    pub name: String,
    #[serde(rename = "type")]
    pub param_type: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct ContractInstance {
    pub contract_name: String,
    pub address: String,
    pub chain: u64,
    pub timestamp: u64,
    pub constructor_args: Option<Vec<String>>,
    pub constructor_params: Vec<ParamInfo>,
}

#[derive(Serialize)]
pub struct OnChainBytecodeIntegrityResult {
    pub contract_name: String,
    pub address: String,
    pub chain: u64,
    pub matches: Option<bool>,
    pub reason: Option<String>,
    pub verified_at: u64,
}

#[derive(Serialize)]
pub struct BalanceResult {
    pub address: String,
    pub chain: u64,
    pub balance_wei: Option<String>,
    pub error: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
pub struct DeploymentEvent {
    pub tx_hash: String,
    pub contract_name: String,
    pub address: String,
    pub chain: u64,
    pub timestamp: u64,
    pub gas_used: Option<String>,
    pub effective_gas_price: Option<String>,
    pub constructor_args: Option<Vec<String>>,
    pub status: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
pub struct FunctionInfo {
    pub name: String,
    pub inputs: Vec<ParamInfo>,
    pub outputs: Vec<ParamInfo>,
    pub present: bool,
}

pub trait HasContractName {
    fn contract_name(&self) -> &str;
}

impl HasContractName for ContractInstance {
    fn contract_name(&self) -> &str {
        &self.contract_name
    }
}

impl HasContractName for OnChainBytecodeIntegrityResult {
    fn contract_name(&self) -> &str {
        &self.contract_name
    }
}

#[derive(Debug, Deserialize)]
pub struct ArtifactSettings {
    #[serde(rename = "compilationTarget")]
    pub compilation_target: HashMap<String, String>,
}

#[derive(Debug, Deserialize)]
pub struct ArtifactMetadata {
    pub settings: ArtifactSettings,
}

#[derive(Serialize)]
pub struct ChainInfo {
    pub chain: u64,
    pub explorer_url: Option<String>,
}