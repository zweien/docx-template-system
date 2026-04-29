use serde::Serialize;
use std::sync::atomic::{AtomicU16, Ordering};
use tauri::AppHandle;

static SIDECAR_PORT: AtomicU16 = AtomicU16::new(0);

#[derive(Serialize)]
pub struct SidecarInfo {
    pub port: u16,
}

#[tauri::command]
pub fn get_sidecar_port() -> Result<SidecarInfo, String> {
    let port = SIDECAR_PORT.load(Ordering::SeqCst);
    if port == 0 {
        return Err("Sidecar not ready".to_string());
    }
    Ok(SidecarInfo { port })
}

#[tauri::command]
pub async fn select_excel(app: AppHandle) -> Result<Option<String>, String> {
    use tauri_plugin_dialog::DialogExt;
    let file_path = app
        .dialog()
        .file()
        .add_filter("Excel", &["xlsx", "xls"])
        .blocking_pick_file();
    Ok(file_path.map(|p| p.to_string()))
}

#[tauri::command]
pub async fn select_output_dir(app: AppHandle) -> Result<Option<String>, String> {
    use tauri_plugin_dialog::DialogExt;
    let dir_path = app.dialog().file().blocking_pick_folder();
    Ok(dir_path.map(|p| p.to_string()))
}

#[tauri::command]
pub async fn open_report(app: AppHandle, path: String) -> Result<(), String> {
    use tauri_plugin_shell::ShellExt;
    app.shell()
        .open(&path, None)
        .map_err(|e| format!("Failed to open report: {}", e))?;
    Ok(())
}

pub fn set_sidecar_port(port: u16) {
    SIDECAR_PORT.store(port, Ordering::SeqCst);
}
