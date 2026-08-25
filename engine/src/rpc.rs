use serde_json::json;

pub async fn rpc_call(rpc_url: &str, method: &str, params: serde_json::Value) -> Result<String, Box<dyn std::error::Error>> {
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
        .ok_or("No result field in response".into())
        .map(|s| s.to_string())
}

pub async fn get_deployed_code(rpc_url: &str, address: &str) -> Result<String, Box<dyn std::error::Error>> {
    rpc_call(rpc_url, "eth_getCode", json!([address, "latest"])).await
}

pub async fn get_balance(rpc_url: &str, address: &str) -> Result<String, Box<dyn std::error::Error>> {
    rpc_call(rpc_url, "eth_getBalance", json!([address, "latest"])).await
}

pub async fn eth_call(rpc_url: &str, address: &str, calldata_hex: &str) -> Result<String, Box<dyn std::error::Error>> {
    rpc_call(rpc_url, "eth_call", json!([{"to": address, "data": calldata_hex}, "latest"])).await
}