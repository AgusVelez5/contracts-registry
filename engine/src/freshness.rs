use crate::errors::AppError;
use crate::models::ContractArtifact;

pub fn source_modified_since_build(
    artifact: &ContractArtifact,
    artifact_path: &str,
    project_root: &str,
) -> Result<bool, AppError> {
    let source_path = artifact.source_path().ok_or_else(|| {
        AppError::Internal("Artifact metadata is missing compilationTarget".to_string())
    })?;

    let full_source_path = format!("{project_root}/{source_path}");

    let source_modified = std::fs::metadata(&full_source_path)
        .and_then(|m| m.modified())
        .map_err(|e| AppError::Internal(format!("Failed to read metadata for '{full_source_path}': {e}")))?;

    let artifact_modified = std::fs::metadata(artifact_path)
        .and_then(|m| m.modified())
        .map_err(|e| AppError::Internal(format!("Failed to read metadata for '{artifact_path}': {e}")))?;

    Ok(source_modified > artifact_modified)
}