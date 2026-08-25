use tokio::process::Command;

pub async fn run_forge_build(project_root: &str) -> Result<(bool, String), Box<dyn std::error::Error>> {
    let output = Command::new("forge")
        .arg("build")
        .current_dir(project_root)
        .output()
        .await?;

    let success = output.status.success();
    let log = if success {
        String::from_utf8_lossy(&output.stdout).to_string()
    } else {
        String::from_utf8_lossy(&output.stderr).to_string()
    };

    Ok((success, log))
}