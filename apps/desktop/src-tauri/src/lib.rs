mod commands;
mod sidecar;

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            let handle = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                if let Err(e) = sidecar::start(&handle).await {
                    eprintln!("Failed to start sidecar: {}", e);
                }
            });
            Ok(())
        })
        .on_window_event(|_window, event| {
            if let tauri::WindowEvent::Destroyed = event {
                crate::sidecar::stop();
            }
        })
        .invoke_handler(tauri::generate_handler![
            commands::get_sidecar_port,
            commands::get_sidecar_status,
            commands::get_sidecar_logs,
            commands::select_excel,
            commands::select_output_dir,
            commands::open_report,
            commands::select_docx,
            commands::save_file_as,
            commands::save_report_as,
            commands::save_data_as,
            commands::list_templates,
            commands::import_template,
            commands::delete_template,
            commands::rename_template,
            commands::get_app_data_dir,
            commands::list_configs,
            commands::save_config,
            commands::delete_config,
            commands::export_config,
            commands::import_config,
            commands::sidecar_post,
            commands::sidecar_get,
            commands::read_file_base64,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
