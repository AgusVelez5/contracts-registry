use serde_json::json;
use std::error::Error;

type RpcError = Box<dyn Error + Send + Sync>;

pub async fn rpc_call(rpc_url: &str, method: &str, params: serde_json::Value) -> Result<String, RpcError> {
    let client = reqwest::Client::new();

    let request_body = json!({
        "jsonrpc": "2.0",
        "method": method,
        "params": params,
        "id": 1
    });

    let response: serde_json::Value = client
        .post(rpc_url)
        .json(&request_body)
        .send()
        .await?
        .json()
        .await?;

    response["result"]
        .as_str()
        .ok_or_else(|| "No result field in response".into())
        .map(|s| s.to_string())
}

pub async fn get_deployed_code(rpc_url: &str, address: &str) -> Result<String, RpcError> {
    rpc_call(rpc_url, "eth_getCode", json!([address, "latest"])).await
}

pub async fn get_balance(rpc_url: &str, address: &str) -> Result<String, RpcError> {
    rpc_call(rpc_url, "eth_getBalance", json!([address, "latest"])).await
}

pub async fn eth_call(rpc_url: &str, address: &str, calldata_hex: &str) -> Result<String, RpcError> {
    rpc_call(rpc_url, "eth_call", json!([{"to": address, "data": calldata_hex}, "latest"])).await
}

pub async fn get_storage_at(rpc_url: &str, address: &str, slot: &str) -> Result<String, RpcError> {
    rpc_call(rpc_url, "eth_getStorageAt", json!([address, slot, "latest"])).await
}