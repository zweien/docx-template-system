use std::process::Stdio;
use std::sync::Mutex;
use tauri::{AppHandle, Manager};
use tokio::io::{AsyncBufReadExt, BufReader};
use tokio::process::{Child, Command};
use tokio::time::{sleep, Duration};

use crate::commands;

static SIDECAR_CHILD: Mutex<Option<Child>> = Mutex::new(None);

pub async fn start(app: &AppHandle) -> Result<(), String> {
    let port = find_free_port().ok_or("No free port available")?;
    commands::set_sidecar_port(port);

    let sidecar_dir = app
        .path()
        .resolve("sidecar", tauri::path::BaseDirectory::Resource)
        .map_err(|e: tauri::Error| e.to_string())?;

    // Try PyInstaller binary first, then bundled python, then system python (dev mode)
    let bin_name = format!("budget-sidecar{}", std::env::consts::EXE_SUFFIX);
    let bundled_bin = sidecar_dir.join("budget-sidecar").join(bin_name);
    let (cmd, args) = if bundled_bin.exists() {
        // Production: PyInstaller binary
        (bundled_bin.as_os_str().to_owned(), vec![])
    } else {
        // Dev mode: system python3
        let main_py = sidecar_dir.join("main.py");
        if !main_py.exists() {
            return Err("Sidecar main.py not found".to_string());
        }
        (std::ffi::OsString::from("python3"), vec![main_py])
    };

    let mut child = Command::new(&cmd)
        .args(&args)
        .env("SIDECAR_PORT", port.to_string())
        .env("PYTHONPATH", sidecar_dir.to_string_lossy().to_string())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| format!("Failed to start sidecar: {}", e))?;

    // Take stdout/stderr before moving child into mutex
    let stdout = child.stdout.take();
    let stderr = child.stderr.take();

    // Save child handle for cleanup on exit
    if let Ok(mut guard) = SIDECAR_CHILD.lock() {
        *guard = Some(child);
    }

    // Read stdout
    if let Some(stdout) = stdout {
        let reader = BufReader::new(stdout);
        tauri::async_runtime::spawn(async move {
            let mut lines = reader.lines();
            while let Ok(Some(line)) = lines.next_line().await {
                println!("[sidecar stdout] {}", line);
            }
        });
    }

    // Read stderr
    if let Some(stderr) = stderr {
        let reader = BufReader::new(stderr);
        tauri::async_runtime::spawn(async move {
            let mut lines = reader.lines();
            while let Ok(Some(line)) = lines.next_line().await {
                eprintln!("[sidecar stderr] {}", line);
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

pub fn stop() {
    if let Ok(mut guard) = SIDECAR_CHILD.lock() {
        if let Some(mut child) = guard.take() {
            let _ = child.kill();
            let _ = child.wait();
        }
    }
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
