use base64::Engine;
use serde::{Deserialize, Serialize};
use std::fs;
use std::io::Read;
use std::path::PathBuf;
use std::sync::atomic::{AtomicU16, Ordering};
use std::sync::OnceLock;
use tauri::{AppHandle, Manager};
use tokio::time::{sleep, Duration};

// ── Validation helpers ──

fn validate_docx_basic(path: &PathBuf) -> Result<(), String> {
    match path.extension().and_then(|e| e.to_str()) {
        Some("docx") | Some("DOCX") => {}
        Some(ext) => return Err(format!("文件扩展名应为 .docx，实际为 .{}", ext)),
        None => return Err("文件没有扩展名，期望 .docx".to_string()),
    }
    let metadata = fs::metadata(path).map_err(|e| format!("无法读取文件信息: {}", e))?;
    if metadata.len() == 0 {
        return Err("文件为空（0 字节）".to_string());
    }
    if metadata.len() > 50 * 1024 * 1024 {
        return Err(format!("文件过大（{} MB，上限 50 MB）", metadata.len() / 1024 / 1024));
    }
    let mut file = fs::File::open(path).map_err(|e| format!("无法打开文件: {}", e))?;
    let mut magic = [0u8; 4];
    if file.read_exact(&mut magic).is_err() || magic != [0x50, 0x4B, 0x03, 0x04] {
        return Err("文件不是有效的 DOCX（ZIP 格式校验失败）".to_string());
    }
    Ok(())
}

fn validate_config_structure(val: &serde_json::Value) -> Result<(), String> {
    let obj = val.as_object().ok_or("配置必须是 JSON 对象")?;
    if !obj.contains_key("title") {
        return Err("配置缺少必填字段: title".to_string());
    }
    if let Some(sheets) = obj.get("sheets") {
        if !sheets.is_array() {
            return Err("sheets 字段必须是数组".to_string());
        }
        let mut seen_ids = std::collections::HashSet::new();
        for (i, sheet) in sheets.as_array().unwrap().iter().enumerate() {
            let s = sheet.as_object().ok_or_else(|| format!("sheets[{}] 必须是对象", i))?;
            for field in &["name", "sheet_name", "id"] {
                if !s.contains_key(*field) || s[*field].as_str().map_or(true, |v| v.is_empty()) {
                    return Err(format!("sheets[{}] 缺少必填字段: {}", i, field));
                }
            }
            let id = s["id"].as_str().unwrap();
            if !seen_ids.insert(id.to_string()) {
                return Err(format!("重复的 sheet id: {}", id));
            }
        }
    }
    Ok(())
}

static SIDECAR_PORT: AtomicU16 = AtomicU16::new(0);

#[derive(Serialize)]
pub struct SidecarInfo {
    pub port: u16,
}

// ── Config types ──

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct ConfigMeta {
    pub id: String,
    pub title: String,
    pub updated_at: String,
    pub size: u64,
    pub excel_path: Option<String>,
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

#[tauri::command]
pub async fn save_data_as(
    app: AppHandle,
    suggested_name: String,
    data: String,
    is_base64: bool,
) -> Result<Option<String>, String> {
    use tauri_plugin_dialog::DialogExt;
    let ext = PathBuf::from(&suggested_name)
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("bin")
        .to_string();
    let file_path = app
        .dialog()
        .file()
        .add_filter(&format!("{} File", ext.to_uppercase()), &[ext.as_str()])
        .set_file_name(&suggested_name)
        .blocking_save_file();
    match file_path {
        Some(fp) => {
            let path = fp.into_path().map_err(|e| format!("无效路径: {}", e))?;
            if is_base64 {
                let bytes = base64::engine::general_purpose::STANDARD
                    .decode(&data)
                    .map_err(|e| format!("Base64 解码失败: {}", e))?;
                fs::write(&path, bytes).map_err(|e| format!("写入失败: {}", e))?;
            } else {
                fs::write(&path, data).map_err(|e| format!("写入失败: {}", e))?;
            }
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
        return Err("源文件不存在".to_string());
    }
    validate_docx_basic(&source)?;
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

// ── Config management ──

fn configs_dir(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|e: tauri::Error| e.to_string())?
        .join("configs");
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    Ok(dir)
}

#[tauri::command]
pub fn list_configs(app: AppHandle) -> Result<Vec<ConfigMeta>, String> {
    let dir = configs_dir(&app)?;
    let mut configs = Vec::new();
    let entries = fs::read_dir(&dir).map_err(|e| e.to_string())?;
    for entry in entries.flatten() {
        let path = entry.path();
        if path.extension().and_then(|e| e.to_str()) == Some("json") {
            if let Ok(data) = fs::read_to_string(&path) {
                if let Ok(val) = serde_json::from_str::<serde_json::Value>(&data) {
                    let title = val.get("title").and_then(|v| v.as_str()).unwrap_or("未命名").to_string();
                    let excel_path = val.get("excel_path").and_then(|v| v.as_str()).map(|s| s.to_string());
                    let id = path
                        .file_stem()
                        .and_then(|n| n.to_str())
                        .unwrap_or_default()
                        .to_string();
                    let updated_at = fs::metadata(&path)
                        .ok()
                        .and_then(|m| m.modified().ok())
                        .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
                        .map(|d| d.as_secs().to_string())
                        .unwrap_or_default();
                    let size = fs::metadata(&path)
                        .map(|m| m.len())
                        .unwrap_or(0);
                    configs.push(ConfigMeta {
                        id,
                        title,
                        updated_at,
                        size,
                        excel_path,
                    });
                }
            }
        }
    }
    configs.sort_by(|a, b| b.updated_at.cmp(&a.updated_at));
    Ok(configs)
}

#[tauri::command]
pub fn save_config(
    app: AppHandle,
    id: Option<String>,
    config_json: String,
) -> Result<ConfigMeta, String> {
    let dir = configs_dir(&app)?;
    // Validate it's valid JSON and extract title
    let val: serde_json::Value =
        serde_json::from_str(&config_json).map_err(|e| format!("JSON 解析失败: {}", e))?;
    validate_config_structure(&val)?;
    let title = val
        .get("title")
        .and_then(|v| v.as_str())
        .unwrap_or("未命名")
        .to_string();
    let config_id = id.unwrap_or_else(|| uuid::Uuid::new_v4().to_string());
    let path = dir.join(format!("{}.json", config_id));
    let pretty = serde_json::to_string_pretty(&val).map_err(|e| e.to_string())?;
    fs::write(&path, pretty).map_err(|e| e.to_string())?;
    let updated_at = fs::metadata(&path)
        .ok()
        .and_then(|m| m.modified().ok())
        .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
        .map(|d| d.as_secs().to_string())
        .unwrap_or_default();
    Ok(ConfigMeta {
        id: config_id,
        title,
        updated_at,
        size: fs::metadata(&path).map(|m| m.len()).unwrap_or(0),
        excel_path: val.get("excel_path").and_then(|v| v.as_str()).map(|s| s.to_string()),
    })
}

#[tauri::command]
pub fn delete_config(app: AppHandle, id: String) -> Result<(), String> {
    let dir = configs_dir(&app)?;
    let path = dir.join(format!("{}.json", id));
    if path.exists() {
        fs::remove_file(path).map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
pub fn export_config(app: AppHandle, id: String) -> Result<String, String> {
    let dir = configs_dir(&app)?;
    let path = dir.join(format!("{}.json", id));
    if !path.exists() {
        return Err("配置不存在".to_string());
    }
    fs::read_to_string(&path).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn read_file_base64(path: String) -> Result<String, String> {
    let path = PathBuf::from(&path);
    if !path.exists() {
        return Err(format!("文件不存在: {}", path.display()));
    }
    let bytes = fs::read(&path).map_err(|e| format!("读取失败: {}", e))?;
    Ok(base64::engine::general_purpose::STANDARD.encode(&bytes))
}

#[tauri::command]
pub fn import_config(app: AppHandle, config_json: String) -> Result<ConfigMeta, String> {
    // Validate JSON, then save as-is preserving all fields
    let _: serde_json::Value =
        serde_json::from_str(&config_json).map_err(|e| format!("JSON 解析失败: {}", e))?;
    save_config(app, None, config_json)
}

// ── Sidecar API proxy ──

static HTTP_CLIENT: OnceLock<reqwest::Client> = OnceLock::new();

fn http_client() -> &'static reqwest::Client {
    HTTP_CLIENT.get_or_init(|| {
        reqwest::Client::builder()
            .connect_timeout(Duration::from_secs(5))
            .timeout(Duration::from_secs(120))
            .build()
            .expect("Failed to create HTTP client")
    })
}

async fn sidecar_request_inner(
    app: &AppHandle,
    method: &str,
    path: &str,
    body: Option<&str>,
) -> Result<String, String> {
    let client = http_client();
    let mut last_error = String::new();

    for attempt in 0..3 {
        if attempt > 0 {
            sleep(Duration::from_millis(1000)).await;
        }

        // Restart sidecar if dead
        if !crate::sidecar::is_alive() {
            eprintln!("[sidecar] Process dead, restarting...");
            if let Err(e) = crate::sidecar::start(app).await {
                last_error = format!("重启 sidecar 失败: {}", e);
                continue;
            }
        }

        let port = SIDECAR_PORT.load(Ordering::SeqCst);
        if port == 0 {
            last_error = "Sidecar 未就绪（端口为 0）".to_string();
            continue;
        }

        let url = format!("http://127.0.0.1:{}{}", port, path);

        let result = match method {
            "POST" => {
                client
                    .post(&url)
                    .header("Content-Type", "application/json")
                    .body(body.unwrap_or_default().to_string())
                    .send()
                    .await
            }
            "GET" => client.get(&url).send().await,
            _ => return Err(format!("不支持的方法: {}", method)),
        };

        match result {
            Ok(res) => {
                let status = res.status();
                let text = res
                    .text()
                    .await
                    .map_err(|e| format!("读取响应失败: {}", e))?;
                if !status.is_success() {
                    return Err(format!("HTTP {}: {}", status, text));
                }
                return Ok(text);
            }
            Err(e) => {
                eprintln!(
                    "[sidecar] {} {} attempt {} failed: {}",
                    method,
                    path,
                    attempt + 1,
                    e
                );
                last_error = e.to_string();
            }
        }
    }

    Err(format!("请求失败（已重试3次）: {}", last_error))
}

#[tauri::command]
pub async fn sidecar_post(
    app: AppHandle,
    path: String,
    body: String,
) -> Result<String, String> {
    sidecar_request_inner(&app, "POST", &path, Some(&body)).await
}

#[tauri::command]
pub async fn sidecar_get(app: AppHandle, path: String) -> Result<String, String> {
    sidecar_request_inner(&app, "GET", &path, None).await
}
