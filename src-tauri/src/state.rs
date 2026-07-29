use std::sync::Mutex;
use std::time::Duration;

use crate::db::TraceStore;

/// Shared, long-lived process state.
pub struct AppState {
    /// SQLite trace store. A single connection behind a mutex is plenty: writes
    /// happen at human speed, one checkpoint at a time.
    pub store: Mutex<TraceStore>,
    pub http: reqwest::Client,
}

impl AppState {
    pub fn new(store: TraceStore) -> Self {
        let http = reqwest::Client::builder()
            .timeout(Duration::from_secs(20))
            // Identifies the tool to Crossref/OpenAlex, which both ask for a
            // contactable user agent in their polite-pool guidance.
            .user_agent(concat!(
                "SocraticCitationCoach/",
                env!("CARGO_PKG_VERSION"),
                " (SIT capstone tool; local-first)"
            ))
            .build()
            .expect("failed to build HTTP client");

        Self {
            store: Mutex::new(store),
            http,
        }
    }
}
