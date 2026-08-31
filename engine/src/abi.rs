use alloy_dyn_abi::{ DynSolType, DynSolValue };
use alloy_json_abi::{Function, JsonAbi, Param};
use crate::rpc::eth_call;
use crate::models::ParamInfo;

pub fn get_readable_functions(abi: &JsonAbi) -> Vec<&Function> {
    abi.functions()
        .filter(|f| {
            matches!(
                f.state_mutability,
                alloy_json_abi::StateMutability::View | alloy_json_abi::StateMutability::Pure
            )
        })
        .collect()
}

pub fn parse_input(param: &Param, raw_value: &str) -> Result<alloy_dyn_abi::DynSolValue, Box<dyn std::error::Error + Send + Sync>> {
    let sol_type: DynSolType = param.ty.parse()?;
    let value = sol_type.coerce_str(raw_value)?;
    Ok(value)
}

pub fn format_sol_value(value: &DynSolValue) -> String {
    match value {
        DynSolValue::Bool(b) => b.to_string(),
        DynSolValue::Uint(n, _) => n.to_string(),
        DynSolValue::Int(n, _) => n.to_string(),
        DynSolValue::Address(addr) => addr.to_string(),
        DynSolValue::String(s) => s.clone(),
        DynSolValue::Bytes(b) => format!("0x{}", hex::encode(b)),
        DynSolValue::FixedBytes(b, _) => format!("0x{}", hex::encode(b)),
        DynSolValue::Array(items) | DynSolValue::FixedArray(items) => {
            let formatted: Vec<String> = items.iter().map(format_sol_value).collect();
            format!("[{}]", formatted.join(", "))
        }
        DynSolValue::Tuple(items) => {
            let formatted: Vec<String> = items.iter().map(format_sol_value).collect();
            format!("({})", formatted.join(", "))
        }
        other => format!("{:?}", other),
    }
}

pub async fn call_read_function(
    rpc_url: &str,
    address: &str,
    function: &Function,
    raw_args: &[String],
) -> Result<Vec<alloy_dyn_abi::DynSolValue>, Box<dyn std::error::Error + Send + Sync>> {
    let mut values = Vec::new();
    for (param, raw) in function.inputs.iter().zip(raw_args) {
        values.push(parse_input(param, raw)?);
    }

    let selector = function.selector();
    let mut calldata = selector.to_vec();
    for value in &values {
        calldata.extend(value.abi_encode());
    }

    let calldata_hex = format!("0x{}", hex::encode(&calldata));
    let result_hex = eth_call(rpc_url, address, &calldata_hex).await?;
    let result_bytes = hex::decode(result_hex.trim_start_matches("0x"))?;
    let output_types: Vec<DynSolType> = function
        .outputs
        .iter()
        .map(|p| p.ty.parse())
        .collect::<Result<_, _>>()?;

    let decoded = DynSolType::Tuple(output_types).abi_decode(&result_bytes)?;
    match decoded {
        alloy_dyn_abi::DynSolValue::Tuple(values) => Ok(values),
        other => Ok(vec![other]),
    }
}

pub fn is_selector_present(deployed_bytecode_hex: &str, selector: &[u8; 4]) -> bool {
    let mut pattern = vec![0x63u8]; // PUSH4 opcode
    pattern.extend_from_slice(selector);
    let pattern_hex = hex::encode(&pattern);

    deployed_bytecode_hex.to_lowercase().contains(&pattern_hex)
}

pub fn get_constructor_params(abi: &JsonAbi) -> Vec<ParamInfo> {
    abi.constructor
        .as_ref()
        .map(|c| {
            c.inputs
                .iter()
                .map(|p| ParamInfo { name: p.name.clone(), param_type: p.ty.clone() })
                .collect()
        })
        .unwrap_or_default()
}