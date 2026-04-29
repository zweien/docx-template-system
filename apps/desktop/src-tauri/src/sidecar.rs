use std::process::Stdio;
use tauri::AppHandle;
use tokio::io::{AsyncBufReadExt, BufReader};
use tokio::process::Command;
use tokio::time::{sleep, Duration};

use crate::commands;

pub async fn start(app: &AppHandle) -> Result<(), String> {
    let port = find_free_port().ok_or("No free port available")?;
    commands::set_sidecar_port(port);

    let sidecar_dir = app
        .path()
        .resolve("sidecar", tauri::path::BaseDirectory::Resource)
        .map_err(|e| e.to_string())?;

    let python_exe = if cfg!(windows) {
        sidecar_dir.join("python").join("python.exe")
    } else {
        sidecar_dir.join("python").join("bin").join("python")
    };

    let mut child = Command::new(python_exe)
        .arg(sidecar_dir.join("main.py"))
        .env("SIDECAR_PORT", port.to_string())
        .env("PYTHONPATH", sidecar_dir.to_string_lossy().to_string())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| format!("Failed to start sidecar: {}", e))?;

    if let Some(stdout) = child.stdout.take() {
        let reader = BufReader::new(stdout);
        tauri::async_runtime::spawn(async move {
            let mut lines = reader.lines();
            while let Ok(Some(line)) = lines.next_line().await {
                println!("[sidecar stdout] {}", line);
            }
        });
    }

    let client = reqwest::Client::new();
    for _ in 0..30 {
        sleep(Duration::from_millis(500)).await;
        if let Ok(resp) = client
            .get(format!("http://127.0.0.1:{}/health", port))
            .timeout(Duration::from_secs(2))
            .send()
            .await
        {
            if resp.status().is_success() {
                println!("Sidecar ready on port {}", port);
                return Ok(());
            }
        }
    }

    Err("Sidecar health check timeout".to_string())
}

fn find_free_port() -> Option<u16> {
    use std::net::TcpListener;
    for port in 50000..60000 {
        if TcpListener::bind(("127.0.0.1", port)).is_ok() {
            return Some(port);
        }
    }
    None
}
