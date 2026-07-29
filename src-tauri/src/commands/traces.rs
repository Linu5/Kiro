use tauri::State;

use crate::db::{
    CheckpointRecord, DocumentRecord, DocumentSummary, EvaluationRecord, StoredTrace,
};
use crate::error::{CoreError, CoreResult};
use crate::state::AppState;

/// Thin command layer over the SQLite trace store. All of it is local: no
/// command in this module opens a socket.
fn lock<'a>(
    state: &'a State<'_, AppState>,
) -> CoreResult<std::sync::MutexGuard<'a, crate::db::TraceStore>> {
    state
        .store
        .lock()
        .map_err(|_| CoreError::msg("the trace store lock was poisoned; restart the app"))
}

#[tauri::command]
pub fn save_document(state: State<'_, AppState>, document: DocumentRecord) -> CoreResult<()> {
    lock(&state)?.save_document(&document)
}

#[tauri::command]
pub fn update_reference_authenticity(
    state: State<'_, AppState>,
    reference_id: String,
    authenticity_json: String,
) -> CoreResult<()> {
    lock(&state)?.update_reference_authenticity(&reference_id, &authenticity_json)
}

#[tauri::command]
pub fn save_checkpoint(state: State<'_, AppState>, checkpoint: CheckpointRecord) -> CoreResult<()> {
    lock(&state)?.save_checkpoint(&checkpoint)
}

#[tauri::command]
pub fn save_evaluation(state: State<'_, AppState>, evaluation: EvaluationRecord) -> CoreResult<()> {
    lock(&state)?.save_evaluation(&evaluation)
}

#[tauri::command]
pub fn list_documents(state: State<'_, AppState>) -> CoreResult<Vec<DocumentSummary>> {
    lock(&state)?.list_documents()
}

#[tauri::command]
pub fn load_trace(state: State<'_, AppState>, document_id: String) -> CoreResult<Option<StoredTrace>> {
    lock(&state)?.load_trace(&document_id)
}

#[tauri::command]
pub fn delete_document(state: State<'_, AppState>, document_id: String) -> CoreResult<()> {
    lock(&state)?.delete_document(&document_id)
}
