use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use std::sync::atomic::{AtomicU16, Ordering};
use tauri::{AppHandle, Manager};

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

pub fn set_sidecar_port(port: u16) {
    SIDECAR_PORT.store(port, Ordering::SeqCst);
}

// ── File dialogs ──

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

#[tauri::command]
pub async fn select_docx(app: AppHandle) -> Result<Option<String>, String> {
    use tauri_plugin_dialog::DialogExt;
    let file_path = app
        .dialog()
        .file()
        .add_filter("Word Template", &["docx"])
        .blocking_pick_file();
    Ok(file_path.map(|p| p.to_string()))
}

#[tauri::command]
pub async fn save_file_as(app: AppHandle, suggested_name: String) -> Result<Option<String>, String> {
    use tauri_plugin_dialog::DialogExt;
    let file_path = app
        .dialog()
        .file()
        .add_filter("Word Document", &["docx"])
        .set_file_name(&suggested_name)
        .blocking_pick_file();
    Ok(file_path.map(|p| p.to_string()))
}

// ── Template management ──

#[derive(Serialize, Deserialize, Clone)]
pub struct TemplateMeta {
    pub id: String,
    pub name: String,
    pub filename: String,
    pub path: String,
    pub size: u64,
    pub imported_at: String,
}

fn templates_dir(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|e: tauri::Error| e.to_string())?
        .join("templates");
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    Ok(dir)
}

#[tauri::command]
pub fn list_templates(app: AppHandle) -> Result<Vec<TemplateMeta>, String> {
    let dir = templates_dir(&app)?;
    let mut templates = Vec::new();
    let entries = fs::read_dir(&dir).map_err(|e| e.to_string())?;
    for entry in entries.flatten() {
        let path = entry.path();
        if path.extension().and_then(|e| e.to_str()) == Some("docx") {
            let metadata = fs::metadata(&path).map_err(|e| e.to_string())?;
            let filename = path
                .file_name()
                .and_then(|n| n.to_str())
                .unwrap_or_default()
                .to_string();
            let id = path
                .file_stem()
                .and_then(|n| n.to_str())
                .unwrap_or_default()
                .to_string();
            let name = id.replace('_', " ");
            templates.push(TemplateMeta {
                id,
                name,
                filename,
                path: path.to_string_lossy().to_string(),
                size: metadata.len(),
                imported_at: metadata
                    .modified()
                    .ok()
                    .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
                    .map(|d| d.as_secs().to_string())
                    .unwrap_or_default(),
            });
        }
    }
    templates.sort_by(|a, b| b.imported_at.cmp(&a.imported_at));
    Ok(templates)
}

#[tauri::command]
pub fn import_template(app: AppHandle, source_path: String) -> Result<TemplateMeta, String> {
    let dir = templates_dir(&app)?;
    let source = PathBuf::from(&source_path);
    if !source.exists() {
        return Err("Source file not found".to_string());
    }
    let id = uuid::Uuid::new_v4().to_string();
    let dest = dir.join(format!("{}.docx", id));
    fs::copy(&source, &dest).map_err(|e| e.to_string())?;
    let metadata = fs::metadata(&dest).map_err(|e| e.to_string())?;
    let name = source
        .file_stem()
        .and_then(|n| n.to_str())
        .unwrap_or("Template")
        .to_string();
    Ok(TemplateMeta {
        id,
        name,
        filename: dest
            .file_name()
            .and_then(|n| n.to_str())
            .unwrap_or_default()
            .to_string(),
        path: dest.to_string_lossy().to_string(),
        size: metadata.len(),
        imported_at: metadata
            .modified()
            .ok()
            .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
            .map(|d| d.as_secs().to_string())
            .unwrap_or_default(),
    })
}

#[tauri::command]
pub fn delete_template(app: AppHandle, id: String) -> Result<(), String> {
    let dir = templates_dir(&app)?;
    let path = dir.join(format!("{}.docx", id));
    if path.exists() {
        fs::remove_file(path).map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
pub fn get_app_data_dir(app: AppHandle) -> Result<String, String> {
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|e: tauri::Error| e.to_string())?;
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    Ok(dir.to_string_lossy().to_string())
}
