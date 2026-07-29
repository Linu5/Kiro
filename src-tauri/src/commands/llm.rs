use std::time::Instant;

use serde::{Deserialize, Serialize};
use serde_json::json;
use tauri::State;
use url::Url;

use crate::error::{CoreError, CoreResult};
use crate::state::AppState;

/// Bridge to the local reasoning model (Ollama by default).
///
/// Privacy rule: the endpoint must be loopback. An institution that hosts its
/// own inference server can opt in by setting `SCC_ALLOW_REMOTE_LLM=1`, which is
/// a deliberate, auditable act rather than a default.
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LlmRequest {
    pub base_url: String,
    pub model: String,
    pub prompt: String,
    #[serde(default)]
    pub system: Option<String>,
    #[serde(default)]
    pub json: bool,
    #[serde(default)]
    pub temperature: Option<f32>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LlmResponse {
    pub text: String,
    pub model: String,
    pub elapsed_ms: u64,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LlmStatus {
    pub reachable: bool,
    pub base_url: String,
    pub models: Vec<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub detail: Option<String>,
}

fn remote_allowed() -> bool {
    std::env::var("SCC_ALLOW_REMOTE_LLM")
        .map(|value| value == "1" || value.eq_ignore_ascii_case("true"))
        .unwrap_or(false)
}

/// Validate the endpoint and return it without a trailing slash.
fn checked_base(base_url: &str) -> CoreResult<String> {
    let parsed = Url::parse(base_url)
        .map_err(|error| CoreError::msg(format!("invalid model endpoint: {error}")))?;

    if !matches!(parsed.scheme(), "http" | "https") {
        return Err(CoreError::PrivacyPolicy(format!(
            "model endpoint scheme `{}` is not allowed",
            parsed.scheme()
        )));
    }

    let host = parsed.host_str().unwrap_or_default().to_ascii_lowercase();
    let is_loopback = host == "localhost" || host == "127.0.0.1" || host == "::1" || host == "[::1]";
    if !is_loopback && !remote_allowed() {
        return Err(CoreError::PrivacyPolicy(format!(
            "`{host}` is not a loopback address. Report text may only be sent to a local model. \
             Set SCC_ALLOW_REMOTE_LLM=1 to use an institutionally hosted endpoint."
        )));
    }

    Ok(parsed.as_str().trim_end_matches('/').to_string())
}

#[tauri::command]
pub async fn llm_status(state: State<'_, AppState>, base_url: String) -> CoreResult<LlmStatus> {
    let base = match checked_base(&base_url) {
        Ok(base) => base,
        Err(error) => {
            return Ok(LlmStatus {
                reachable: false,
                base_url,
                models: Vec::new(),
                detail: Some(error.to_string()),
            })
        }
    };

    let result = state
        .http
        .get(format!("{base}/api/tags"))
        .send()
        .await
        .and_then(|response| response.error_for_status());

    match result {
        Ok(response) => {
            let body: serde_json::Value = response.json().await.unwrap_or(json!({}));
            let models = body["models"]
                .as_array()
                .map(|entries| {
                    entries
                        .iter()
                        .filter_map(|entry| entry["name"].as_str().map(str::to_string))
                        .collect::<Vec<_>>()
                })
                .unwrap_or_default();
            Ok(LlmStatus {
                reachable: true,
                base_url: base,
                models,
                detail: None,
            })
        }
        Err(error) => Ok(LlmStatus {
            reachable: false,
            base_url: base,
            models: Vec::new(),
            detail: Some(format!(
                "No local model answered ({error}). Start Ollama with `ollama serve` and pull a model."
            )),
        }),
    }
}

#[tauri::command]
pub async fn llm_generate(
    state: State<'_, AppState>,
    request: LlmRequest,
) -> CoreResult<LlmResponse> {
    let base = checked_base(&request.base_url)?;
    let started = Instant::now();

    let mut payload = json!({
        "model": request.model,
        "prompt": request.prompt,
        "stream": false,
        "options": {
            "temperature": request.temperature.unwrap_or(0.2),
            // Keep the context tight: prompts carry one claim at a time.
            "num_ctx": 4096,
        }
    });
    if let Some(system) = request.system.as_ref() {
        payload["system"] = json!(system);
    }
    if request.json {
        payload["format"] = json!("json");
    }

    let response = state
        .http
        .post(format!("{base}/api/generate"))
        // Generation on a laptop-class GPU/CPU can take a while.
        .timeout(std::time::Duration::from_secs(180))
        .json(&payload)
        .send()
        .await?;

    let status = response.status();
    if !status.is_success() {
        let body = response.text().await.unwrap_or_default();
        return Err(CoreError::Http(format!(
            "model endpoint returned {status}: {}",
            body.chars().take(400).collect::<String>()
        )));
    }

    let body: serde_json::Value = response.json().await?;
    let text = body["response"].as_str().unwrap_or_default().to_string();
    if text.trim().is_empty() {
        return Err(CoreError::Http(
            "model returned an empty response - check that the configured model is pulled".into(),
        ));
    }

    Ok(LlmResponse {
        text,
        model: body["model"]
            .as_str()
            .unwrap_or(request.model.as_str())
            .to_string(),
        elapsed_ms: started.elapsed().as_millis() as u64,
    })
}
