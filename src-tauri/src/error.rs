use serde::{Serialize, Serializer};

/// Every command returns this error type. It serialises to a plain string so the
/// TypeScript side can surface it directly in the UI.
#[derive(Debug, thiserror::Error)]
pub enum CoreError {
    #[error("{0}")]
    Message(String),

    #[error("file error: {0}")]
    Io(#[from] std::io::Error),

    #[error("database error: {0}")]
    Db(#[from] rusqlite::Error),

    #[error("network error: {0}")]
    Http(String),

    #[error("invalid data: {0}")]
    Serde(#[from] serde_json::Error),

    /// Raised when a caller tries to reach a host outside the allow-list, or a
    /// non-loopback model endpoint. Kept distinct so it is obvious in logs.
    #[error("blocked by privacy policy: {0}")]
    PrivacyPolicy(String),
}

impl CoreError {
    pub fn msg(detail: impl Into<String>) -> Self {
        Self::Message(detail.into())
    }
}

impl From<reqwest::Error> for CoreError {
    fn from(value: reqwest::Error) -> Self {
        Self::Http(value.to_string())
    }
}

impl Serialize for CoreError {
    fn serialize<S: Serializer>(&self, serializer: S) -> Result<S::Ok, S::Error> {
        serializer.serialize_str(&self.to_string())
    }
}

pub type CoreResult<T> = Result<T, CoreError>;
