use base64::Engine;
use serde::Serialize;
use std::path::{Path, PathBuf};
use tauri::{AppHandle, Manager};

use crate::error::{CoreError, CoreResult};

/// File ingest and export.
///
/// Reports are read from a path the user explicitly chose (drag-and-drop or the
/// native file dialog) and handed to the webview in memory. Exports are written
/// to a single predictable folder so a student can find the artefact to attach
/// to a supervision meeting.
const MAX_REPORT_BYTES: u64 = 40 * 1024 * 1024;
const ALLOWED_EXTENSIONS: [&str; 4] = ["pdf", "docx", "txt", "md"];
const EXPORT_FOLDER: &str = "SocraticCitationCoach";

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct IngestedFile {
    pub file_name: String,
    /// base64; decoded in the webview by the parsing layer.
    pub bytes: String,
    pub extension: String,
    pub size_bytes: u64,
}

fn extension_of(path: &Path) -> String {
    path.extension()
        .and_then(|value| value.to_str())
        .unwrap_or_default()
        .to_ascii_lowercase()
}

#[tauri::command]
pub async fn read_report_file(path: String) -> CoreResult<IngestedFile> {
    let path = PathBuf::from(&path);
    if !path.is_file() {
        return Err(CoreError::msg(format!("{} is not a file", path.display())));
    }

    let extension = extension_of(&path);
    if !ALLOWED_EXTENSIONS.contains(&extension.as_str()) {
        return Err(CoreError::msg(format!(
            "`.{extension}` is not a supported report format (expected PDF, DOCX, TXT or MD)"
        )));
    }

    let metadata = std::fs::metadata(&path)?;
    if metadata.len() > MAX_REPORT_BYTES {
        return Err(CoreError::msg(format!(
            "the file is {:.1} MB; the limit is {} MB",
            metadata.len() as f64 / (1024.0 * 1024.0),
            MAX_REPORT_BYTES / (1024 * 1024)
        )));
    }

    let bytes = std::fs::read(&path)?;
    Ok(IngestedFile {
        file_name: path
            .file_name()
            .and_then(|value| value.to_str())
            .unwrap_or("report")
            .to_string(),
        bytes: base64::engine::general_purpose::STANDARD.encode(&bytes),
        extension,
        size_bytes: metadata.len(),
    })
}

/// Reject path traversal: exports are written by name only.
fn safe_file_name(file_name: &str) -> CoreResult<String> {
    let candidate = Path::new(file_name)
        .file_name()
        .and_then(|value| value.to_str())
        .unwrap_or_default()
        .to_string();
    if candidate.is_empty() || candidate != file_name {
        return Err(CoreError::msg(
            "export file name must not contain a path separator",
        ));
    }
    let extension = extension_of(Path::new(&candidate));
    if !matches!(extension.as_str(), "pdf" | "md") {
        return Err(CoreError::msg("exports may only be written as .pdf or .md"));
    }
    Ok(candidate)
}

#[tauri::command]
pub async fn write_export(
    app: AppHandle,
    file_name: String,
    contents_base64: String,
) -> CoreResult<String> {
    let file_name = safe_file_name(&file_name)?;
    let bytes = base64::engine::general_purpose::STANDARD
        .decode(contents_base64.as_bytes())
        .map_err(|error| CoreError::msg(format!("export payload was not valid base64: {error}")))?;

    let base = app
        .path()
        .document_dir()
        .or_else(|_| app.path().app_data_dir())
        .map_err(|error| CoreError::msg(format!("no writable output directory: {error}")))?;
    let folder = base.join(EXPORT_FOLDER);
    std::fs::create_dir_all(&folder)?;

    let target = folder.join(&file_name);
    std::fs::write(&target, &bytes)?;
    Ok(target.to_string_lossy().to_string())
}
