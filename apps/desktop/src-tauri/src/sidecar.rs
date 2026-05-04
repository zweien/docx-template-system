use std::process::Stdio;
use std::sync::Mutex;
use tauri::{AppHandle, Manager};
use tokio::io::{AsyncBufReadExt, BufReader};
use tokio::process::{Child, Command};
use tokio::time::{sleep, Duration};

use crate::commands;

static SIDECAR_CHILD: Mutex<Option<Child>> = Mutex::new(None);

pub async fn start(app: &AppHandle) -> Result<(), String> {
    let sidecar_dir = app
        .path()
        .resolve("sidecar", tauri::path::BaseDirectory::Resource)
        .map_err(|e| format!("资源目录解析失败: {}", e))?;

    let bin_name = format!("budget-sidecar{}", std::env::consts::EXE_SUFFIX);
    let bundled_bin = sidecar_dir.join("budget-sidecar").join(&bin_name);

    let is_prod = bundled_bin.exists();

    // Log path info for debugging
    println!("[sidecar] Resource dir: {}", sidecar_dir.display());
    println!("[sidecar] Looking for: {}", bundled_bin.display());
    println!("[sidecar] is_prod: {}", is_prod);

    let (cmd, args) = if is_prod {
        println!("[sidecar] Using bundled binary: {}", bundled_bin.display());
        (bundled_bin.as_os_str().to_owned(), vec![])
    } else {
        let main_py = sidecar_dir.join("main.py");
        if !main_py.exists() {
            let err = format!(
                "Sidecar 未找到:\n  打包: {}\n  开发: {}\n  目录内容: {:?}",
                bundled_bin.display(),
                main_py.display(),
                std::fs::read_dir(&sidecar_dir).ok().map(|d| d.filter_map(|e| e.ok()).map(|e| e.path().display().to_string()).collect::<Vec<_>>())
            );
            commands::set_sidecar_error(err.clone());
            return Err(err);
        }
        println!("[sidecar] Using Python dev mode: {}", main_py.display());
        (std::ffi::OsString::from("python3"), vec![main_py])
    };

    let port = find_free_port().ok_or("无可用端口 (50000-60000)")?;

    let mut command = Command::new(&cmd);
    command
        .args(&args)
        .env("SIDECAR_PORT", port.to_string())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());

    // On Windows, hide the console window of the child process
    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        // CREATE_NO_WINDOW = 0x08000000
        command.creation_flags(0x08000000);
    }

    // Only set PYTHONPATH in dev mode — PyInstaller handles its own imports
    if !is_prod {
        command.env("PYTHONPATH", sidecar_dir.to_string_lossy().to_string());
    }

    let mut child = command
        .spawn()
        .map_err(|e| format!("启动 sidecar 失败: {}", e))?;

    let stdout = child.stdout.take();
    let stderr = child.stderr.take();

    if let Ok(mut guard) = SIDECAR_CHILD.lock() {
        *guard = Some(child);
    }

    if let Some(out) = stdout {
        tauri::async_runtime::spawn(async move {
            let mut lines = BufReader::new(out).lines();
            while let Ok(Some(line)) = lines.next_line().await {
                println!("[sidecar] {}", line);
            }
        });
    }
    if let Some(err) = stderr {
        tauri::async_runtime::spawn(async move {
            let mut lines = BufReader::new(err).lines();
            while let Ok(Some(line)) = lines.next_line().await {
                eprintln!("[sidecar] {}", line);
            }
        });
    }

    // Health check — only set port AFTER success
    let client = reqwest::Client::new();
    for i in 0..40 {
        sleep(Duration::from_millis(500)).await;

        if !is_alive() {
            let err_msg = "Sidecar 进程意外退出，请检查日志".to_string();
            commands::set_sidecar_error(err_msg.clone());
            return Err(err_msg);
        }

        if let Ok(resp) = client
            .get(format!("http://127.0.0.1:{}/health", port))
            .timeout(Duration::from_secs(2))
            .send()
            .await
        {
            if resp.status().is_success() {
                commands::set_sidecar_port(port);
                println!("[sidecar] Ready on port {}", port);
                return Ok(());
            }
        }

        if (i + 1) % 10 == 0 {
            println!(
                "[sidecar] Waiting for health check... ({}/40)",
                i + 1
            );
        }
    }

    let err_msg = "Sidecar 健康检查超时（20秒）".to_string();
    commands::set_sidecar_error(err_msg.clone());
    stop();
    Err(err_msg)
}

pub fn is_alive() -> bool {
    if let Ok(mut guard) = SIDECAR_CHILD.lock() {
        match guard.as_mut() {
            Some(child) => match child.try_wait() {
                Ok(None) => true,
                Ok(Some(status)) => {
                    eprintln!("[sidecar] Process exited: {}", status);
                    *guard = None;
                    false
                }
                Err(e) => {
                    eprintln!("[sidecar] Failed to check process: {}", e);
                    false
                }
            },
            None => false,
        }
    } else {
        false
    }
}

pub fn stop() {
    if let Ok(mut guard) = SIDECAR_CHILD.lock() {
        if let Some(mut child) = guard.take() {
            let _ = child.kill();
            let _ = child.wait();
        }
    }
    commands::set_sidecar_port(0);
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
