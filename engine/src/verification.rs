use crate::models::{BytecodeRange, ContractArtifact, ContractInstance};
use crate::rpc::get_deployed_code;
use std::time::{SystemTime, UNIX_EPOCH};

pub enum IntegrityOutcome {
    Matches,
    Mismatches,
    /// Permanent — won't change until the setup itself changes (e.g. uses libraries).
    /// Safe to cache.
    NotSupported(String),
    /// Transient — RPC down, unreadable bytecode. Should NOT overwrite a
    /// previously cached good result; the next GET should retry.
    Failed(String),
}

fn now_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .as_millis() as u64
}

/// Strips the trailing Solidity CBOR metadata blob (compiler version, settings
/// hash, etc.) — its length is length-prefixed in the last 2 bytes, per the
/// same technique Sourcify/Etherscan use. This differs between builds even for
/// identical source code (e.g. absolute path differences), so it must be
/// excluded from a meaningful comparison.
fn strip_metadata(bytes: &[u8]) -> &[u8] {
    if bytes.len() < 2 {
        return bytes;
    }
    let len_bytes = &bytes[bytes.len() - 2..];
    let cbor_len = u16::from_be_bytes([len_bytes[0], len_bytes[1]]) as usize;
    let total_suffix = cbor_len + 2;

    if total_suffix > 0 && total_suffix < bytes.len() {
        &bytes[..bytes.len() - total_suffix]
    } else {
        bytes
    }
}

/// Zeroes out the byte ranges Solidity reports as holding `immutable` variable
/// values (baked into the bytecode at construction time, so they legitimately
/// differ per deployment), then strips the trailing metadata blob. Same
/// algorithm Sourcify uses for its "partial match" verification.
fn normalize_bytecode(bytecode_hex: &str, immutable_ranges: &[BytecodeRange]) -> Vec<u8> {
    let hex_body = bytecode_hex.trim_start_matches("0x");
    let mut bytes = match hex::decode(hex_body) {
        Ok(b) => b,
        Err(_) => return Vec::new(),
    };

    for range in immutable_ranges {
        if range.start < bytes.len() {
            let end = (range.start + range.length).min(bytes.len());
            for byte in &mut bytes[range.start..end] {
                *byte = 0;
            }
        }
    }

    strip_metadata(&bytes).to_vec()
}

pub async fn check_onchain_bytecode_integrity(
    instance: &ContractInstance,
    artifact: &ContractArtifact,
    rpc_url: Option<&str>,
) -> (IntegrityOutcome, u64) {
    let verified_at = now_ms();

    // Contracts linked against external libraries aren't supported yet — we
    // don't track deployed library addresses, so the on-chain bytecode has
    // real linked addresses we have no way to mask or resolve. Fail visibly
    // instead of guessing.
    if !artifact.deployed_bytecode.link_references.is_empty() {
        return (
            IntegrityOutcome::NotSupported(
                "Uses external libraries — bytecode verification isn't supported for linked contracts yet.".to_string(),
            ),
            verified_at,
        );
    }

    let Some(rpc_url) = rpc_url else {
        return (
            IntegrityOutcome::Failed(format!("No RPC configured for chain {}", instance.chain)),
            verified_at,
        );
    };

    let deployed_hex = match get_deployed_code(rpc_url, &instance.address).await {
        Ok(code) => code,
        Err(e) => {
            return (
                IntegrityOutcome::Failed(format!("Failed to fetch deployed bytecode: {e}")),
                verified_at,
            );
        }
    };

    let immutable_ranges: Vec<BytecodeRange> = artifact
        .deployed_bytecode
        .immutable_references
        .values()
        .flatten()
        .cloned()
        .collect();

    let normalized_deployed = normalize_bytecode(&deployed_hex, &immutable_ranges);
    let normalized_local = normalize_bytecode(&artifact.deployed_bytecode.object, &immutable_ranges);

    if normalized_deployed.is_empty() || normalized_local.is_empty() {
        return (
            IntegrityOutcome::Failed("Could not decode bytecode for comparison".to_string()),
            verified_at,
        );
    }

    let outcome = if normalized_deployed == normalized_local {
        IntegrityOutcome::Matches
    } else {
        IntegrityOutcome::Mismatches
    };

    (outcome, verified_at)
}