mod commands;
mod db;
mod error;
mod state;

use tauri::Manager;

use crate::db::TraceStore;
use crate::state::AppState;

/// Application entry point.
///
/// The Rust core owns exactly four responsibilities: file ingest, the local
/// model bridge, metadata verification and the SQLite trace store. Nothing here
/// forwards report content anywhere.
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            let data_dir = app.path().app_data_dir()?;
            std::fs::create_dir_all(&data_dir)?;
            let store = TraceStore::open(&data_dir.join("traces.sqlite"))?;
            app.manage(AppState::new(store));
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::ingest::read_report_file,
            commands::ingest::write_export,
            commands::llm::llm_status,
            commands::llm::llm_generate,
            commands::metadata::verify_source,
            commands::traces::save_document,
            commands::traces::update_reference_authenticity,
            commands::traces::save_checkpoint,
            commands::traces::save_evaluation,
            commands::traces::list_documents,
            commands::traces::load_trace,
            commands::traces::delete_document,
        ])
        .run(tauri::generate_context!())
        .expect("error while running Socratic Citation Coach");
}
