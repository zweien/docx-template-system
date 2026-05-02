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
pub async fn open_report(_app: AppHandle, path: String) -> Result<(), String> {
    let path = PathBuf::from(&path);
    if !path.exists() {
        return Err(format!("文件不存在: {}", path.display()));
    }
    #[cfg(target_os = "linux")]
    {
        std::process::Command::new("xdg-open")
            .arg(&path)
            .spawn()
            .map_err(|e| format!("Failed to open: {}", e))?;
    }
    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .arg(&path)
            .spawn()
            .map_err(|e| format!("Failed to open: {}", e))?;
    }
    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("cmd")
            .args(["/C", "start", "", &path.to_string_lossy()])
            .spawn()
            .map_err(|e| format!("Failed to open: {}", e))?;
    }
    Ok(())
}

#[tauri::command]
pub async fn save_report_as(app: AppHandle, source_path: String, suggested_name: String) -> Result<Option<String>, String> {
    let source = PathBuf::from(&source_path);
    if !source.exists() {
        return Err(format!("源文件不存在: {}", source.display()));
    }
    use tauri_plugin_dialog::DialogExt;
    let dest = app
        .dialog()
        .file()
        .add_filter("Word Document", &["docx"])
        .set_file_name(&suggested_name)
        .blocking_save_file();
    match dest {
        Some(dest_path) => {
            let dest_str = dest_path.into_path().map_err(|e| format!("无效路径: {}", e))?;
            fs::copy(&source, &dest_str).map_err(|e| format!("复制失败: {}", e))?;
            Ok(Some(dest_str.to_string_lossy().to_string()))
        }
        None => Ok(None),
    }
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
        .blocking_save_file();
    match file_path {
        Some(fp) => {
            let path = fp.into_path().map_err(|e| format!("无效路径: {}", e))?;
            Ok(Some(path.to_string_lossy().to_string()))
        }
        None => Ok(None),
    }
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
            let name = {
                let meta_path = dir.join(format!("{}.meta.json", id));
                if meta_path.exists() {
                    if let Ok(data) = fs::read_to_string(&meta_path) {
                        if let Ok(obj) = serde_json::from_str::<serde_json::Value>(&data) {
                            obj.get("name").and_then(|v| v.as_str()).unwrap_or(&id).to_string()
                        } else { id.clone() }
                    } else { id.clone() }
                } else { id.clone() }
            };
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
    let imported_at = metadata
        .modified()
        .ok()
        .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
        .map(|d| d.as_secs().to_string())
        .unwrap_or_default();
    // Save meta file for name persistence
    let meta = serde_json::json!({ "name": &name, "imported_at": &imported_at });
    let meta_path = dir.join(format!("{}.meta.json", id));
    fs::write(&meta_path, meta.to_string()).map_err(|e| e.to_string())?;

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
        imported_at,
    })
}

#[tauri::command]
pub fn delete_template(app: AppHandle, id: String) -> Result<(), String> {
    let dir = templates_dir(&app)?;
    let path = dir.join(format!("{}.docx", id));
    if path.exists() {
        fs::remove_file(path).map_err(|e| e.to_string())?;
    }
    let meta = dir.join(format!("{}.meta.json", id));
    if meta.exists() {
        fs::remove_file(meta).map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
pub fn rename_template(app: AppHandle, id: String, new_name: String) -> Result<(), String> {
    let dir = templates_dir(&app)?;
    let meta_path = dir.join(format!("{}.meta.json", id));
    let imported_at = fs::metadata(&meta_path)
        .ok()
        .and_then(|m| m.modified().ok())
        .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
        .map(|d| d.as_secs().to_string())
        .unwrap_or_default();
    let meta = serde_json::json!({ "name": &new_name, "imported_at": &imported_at });
    fs::write(&meta_path, meta.to_string()).map_err(|e| e.to_string())
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
