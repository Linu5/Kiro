use chrono::Datelike;
use serde::{Deserialize, Serialize};
use tauri::State;

use crate::error::{CoreError, CoreResult};
use crate::state::AppState;

/// Source verification against open scholarly registries.
///
/// This is the *only* module in the application that performs outbound network
/// requests, and the only data it may send is what `SourceQuery` can hold: a
/// DOI, a title, a first-author surname and a year. No report sentence, claim or
/// student rationale is ever part of a request.
const ALLOWED_HOSTS: [&str; 2] = ["api.crossref.org", "api.openalex.org"];

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SourceQuery {
    #[serde(default)]
    pub doi: Option<String>,
    #[serde(default)]
    pub title: Option<String>,
    #[serde(default)]
    pub first_author: Option<String>,
    #[serde(default)]
    pub year: Option<i64>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AuthenticityVerdict {
    pub status: String,
    pub score: i64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub matched_title: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub publisher: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub container_title: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub year: Option<i64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub cited_by_count: Option<i64>,
    /// Citations divided by years since publication, to one decimal. `None` when
    /// the count cannot be interpreted: no year, or a work too recent to judge.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub citations_per_year: Option<f64>,
    /// How the citation count was read, so the score adjustment is auditable
    /// rather than silent: `tooRecent`, `wellCited`, `sparse`, `uncited`.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub citation_signal: Option<String>,
    /// A free full text is available somewhere, per OpenAlex.
    pub is_open_access: bool,
    /// OpenAlex OA colour: `gold`, `green`, `hybrid`, `bronze`, `diamond`, `closed`.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub oa_status: Option<String>,
    #[serde(skip_serializing_if = "Vec::is_empty")]
    pub registry_authors: Vec<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub work_type: Option<String>,
    pub is_preprint: bool,
    /// 0..1 overlap between the cited title and the resolved title.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub title_overlap: Option<f64>,
    pub is_retracted: bool,
    /// The cited work is itself a retraction notice, not a retracted study.
    pub is_retraction_notice: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub retraction_notice_doi: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub retraction_date: Option<String>,
    pub has_expression_of_concern: bool,
    pub is_indexed_in_doaj: bool,
    pub registries: Vec<String>,
    pub flags: Vec<String>,
    pub checked_at: String,
}

#[derive(Default)]
struct Record {
    title: Option<String>,
    publisher: Option<String>,
    container_title: Option<String>,
    year: Option<i64>,
    cited_by_count: Option<i64>,
    retracted: bool,
    in_doaj: bool,
    /// Free full text available, per OpenAlex `open_access.is_oa`. Crossref has
    /// no dependable equivalent, so a Crossref-only record leaves this false.
    is_open_access: bool,
    /// OpenAlex `open_access.oa_status`: gold, green, hybrid, bronze, closed.
    oa_status: Option<String>,
    /// Author list as the registry holds it, so the caller can compare names.
    authors: Vec<String>,
    /// Crossref/OpenAlex work type: journal-article, proceedings-article,
    /// posted-content (preprint)...
    work_type: Option<String>,
    is_preprint: bool,
    /// The cited work *is* a retraction notice, rather than a retracted work.
    is_retraction_notice: bool,
    /// DOI of the notice that retracted this work, when the registry links it.
    retraction_notice_doi: Option<String>,
    /// Date the retraction was recorded, `YYYY-MM-DD` where available.
    retraction_date: Option<String>,
    /// An expression of concern has been issued: weaker than retraction, but the
    /// journal has publicly questioned the work.
    expression_of_concern: bool,
}

/// Crossref `update-to` / `updated-by` entries, matched by relationship type.
struct UpdateScan {
    retraction: bool,
    expression_of_concern: bool,
    notice_doi: Option<String>,
    date: Option<String>,
}

fn scan_updates(list: &serde_json::Value) -> UpdateScan {
    let mut scan = UpdateScan {
        retraction: false,
        expression_of_concern: false,
        notice_doi: None,
        date: None,
    };
    let Some(entries) = list.as_array() else {
        return scan;
    };
    for entry in entries {
        let kind = entry["type"].as_str().unwrap_or_default().to_ascii_lowercase();
        if kind.contains("retraction") || kind.contains("withdrawal") || kind.contains("removal") {
            scan.retraction = true;
            if scan.notice_doi.is_none() {
                scan.notice_doi = entry["DOI"].as_str().map(str::to_string);
            }
            if scan.date.is_none() {
                let parts = &entry["updated"]["date-parts"][0];
                if let Some(year) = parts[0].as_i64() {
                    let month = parts[1].as_i64().unwrap_or(1);
                    let day = parts[2].as_i64().unwrap_or(1);
                    scan.date = Some(format!("{year:04}-{month:02}-{day:02}"));
                }
            }
        } else if kind.contains("concern") {
            scan.expression_of_concern = true;
        }
    }
    scan
}

/// Publishers prefix the title of a retracted or withdrawn article.
fn title_marks_retraction(title: Option<&str>) -> bool {
    let Some(title) = title else { return false };
    let head = title.trim_start().to_ascii_uppercase();
    head.starts_with("RETRACTED")
        || head.starts_with("WITHDRAWN")
        || head.starts_with("[RETRACTED")
        || head.starts_with("RETRACTION NOTICE")
}

fn title_marks_notice(title: Option<&str>) -> bool {
    let Some(title) = title else { return false };
    let head = title.trim_start().to_ascii_uppercase();
    // "Retraction—Ileal-lymphoid…", "Retraction notice to: …"
    (head.starts_with("RETRACTION") || head.starts_with("WITHDRAWAL"))
        && !head.starts_with("RETRACTED")
}

fn guard_host(url: &str) -> CoreResult<()> {
    let parsed = url::Url::parse(url).map_err(|error| CoreError::msg(error.to_string()))?;
    let host = parsed.host_str().unwrap_or_default();
    if !ALLOWED_HOSTS.contains(&host) {
        return Err(CoreError::PrivacyPolicy(format!(
            "host `{host}` is not on the metadata allow-list"
        )));
    }
    Ok(())
}

async fn get_json(state: &AppState, url: &str) -> CoreResult<Option<serde_json::Value>> {
    guard_host(url)?;
    let response = state.http.get(url).send().await?;
    if response.status() == reqwest::StatusCode::NOT_FOUND {
        return Ok(None);
    }
    if !response.status().is_success() {
        return Err(CoreError::Http(format!(
            "{} returned {}",
            url,
            response.status()
        )));
    }
    Ok(Some(response.json::<serde_json::Value>().await?))
}

fn normalise(value: &str) -> String {
    value
        .to_lowercase()
        .chars()
        .map(|c| if c.is_alphanumeric() { c } else { ' ' })
        .collect::<String>()
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ")
}

/// Token-overlap ratio between two titles, 0.0..1.0.
fn title_match(a: &str, b: &str) -> f64 {
    let left: Vec<String> = normalise(a).split(' ').map(str::to_string).collect();
    let right: Vec<String> = normalise(b).split(' ').map(str::to_string).collect();
    if left.is_empty() || right.is_empty() {
        return 0.0;
    }
    let shared = left.iter().filter(|token| right.contains(token)).count();
    shared as f64 / left.len().max(right.len()) as f64
}

fn crossref_record(work: &serde_json::Value) -> Record {
    let year = work["issued"]["date-parts"][0][0]
        .as_i64()
        .or_else(|| work["published"]["date-parts"][0][0].as_i64());
    let authors = work["author"]
        .as_array()
        .map(|list| {
            list.iter()
                .filter_map(|entry| {
                    let family = entry["family"].as_str();
                    let given = entry["given"].as_str();
                    match (given, family) {
                        (Some(g), Some(f)) => Some(format!("{g} {f}")),
                        (None, Some(f)) => Some(f.to_string()),
                        // Consortium / group authorship.
                        _ => entry["name"].as_str().map(str::to_string),
                    }
                })
                .collect::<Vec<_>>()
        })
        .unwrap_or_default();
    let work_type = work["type"].as_str().map(str::to_string);
    let is_preprint = work_type.as_deref() == Some("posted-content");
    let title = work["title"][0].as_str().map(str::to_string);
    let updated_by = scan_updates(&work["updated-by"]);
    let update_to = scan_updates(&work["update-to"]);
    Record {
        authors,
        work_type,
        is_preprint,
        title: title.clone(),
        publisher: work["publisher"].as_str().map(str::to_string),
        container_title: work["container-title"][0].as_str().map(str::to_string),
        year,
        cited_by_count: work["is-referenced-by-count"].as_i64(),
        // Crossref records the relationship from both ends, and the direction
        // matters: the *retracted article* carries `updated-by` pointing at its
        // notice, while the *notice* carries `update-to` pointing back at the
        // article. Reading only `update-to` therefore detects notices and misses
        // retracted papers - Wakefield 1998 has `update-to: null`. The publisher's
        // "RETRACTED:" title prefix is a third, independent signal.
        retracted: updated_by.retraction || title_marks_retraction(title.as_deref()),
        is_retraction_notice: update_to.retraction
            || work["type"].as_str() == Some("retraction")
            || title_marks_notice(title.as_deref()),
        retraction_notice_doi: updated_by.notice_doi.clone().or_else(|| update_to.notice_doi.clone()),
        retraction_date: updated_by.date.clone().or_else(|| update_to.date.clone()),
        expression_of_concern: updated_by.expression_of_concern || update_to.expression_of_concern,
        in_doaj: false,
        // Crossref's `license` array says a licence exists, not that the text is
        // reachable, so inferring OA from it would overstate. Left to OpenAlex.
        is_open_access: false,
        oa_status: None,
    }
}

fn openalex_record(work: &serde_json::Value) -> Record {
    let source = &work["primary_location"]["source"];
    let authors = work["authorships"]
        .as_array()
        .map(|list| {
            list.iter()
                .filter_map(|entry| entry["author"]["display_name"].as_str().map(str::to_string))
                .collect::<Vec<_>>()
        })
        .unwrap_or_default();
    let work_type = work["type"].as_str().map(str::to_string);
    // A repository-hosted submitted version is a preprint, whatever the type says.
    let is_preprint = work_type.as_deref() == Some("preprint")
        || source["type"].as_str() == Some("repository")
        || work["primary_location"]["version"].as_str() == Some("submittedVersion");
    // Already present in every response: neither the DOI lookup nor the title
    // search sends a `select`, so this costs no additional request.
    let open_access = &work["open_access"];
    Record {
        authors,
        work_type,
        is_preprint,
        title: work["display_name"].as_str().map(str::to_string),
        publisher: source["host_organization_name"].as_str().map(str::to_string),
        container_title: source["display_name"].as_str().map(str::to_string),
        year: work["publication_year"].as_i64(),
        cited_by_count: work["cited_by_count"].as_i64(),
        // OpenAlex exposes a single boolean, set on both the retracted work and
        // its notice; `type` separates the two.
        retracted: work["is_retracted"].as_bool().unwrap_or(false)
            && work["type"].as_str() != Some("retraction"),
        is_retraction_notice: work["type"].as_str() == Some("retraction")
            || title_marks_notice(work["display_name"].as_str()),
        retraction_notice_doi: None,
        retraction_date: None,
        expression_of_concern: false,
        in_doaj: source["is_in_doaj"].as_bool().unwrap_or(false),
        is_open_access: open_access["is_oa"].as_bool().unwrap_or(false),
        oa_status: open_access["oa_status"].as_str().map(str::to_string),
    }
}

/// Percent-encode for query strings, per RFC 3986 unreserved set.
///
/// Encoding operates on UTF-8 *bytes*: casting a `char` to `u8` truncates any
/// code point above U+00FF and mangles accented titles, which then fail to match
/// and get reported as fabricated. Only ASCII alphanumerics and `-_.~` are safe
/// to pass through unescaped.
fn encode(value: &str) -> String {
    let mut out = String::with_capacity(value.len());
    for byte in value.as_bytes() {
        let c = *byte as char;
        if c.is_ascii_alphanumeric() || matches!(c, '-' | '_' | '.' | '~') {
            out.push(c);
        } else {
            out.push_str(&format!("%{byte:02X}"));
        }
    }
    out
}

async fn lookup_crossref(state: &AppState, query: &SourceQuery) -> CoreResult<Option<Record>> {
    if let Some(doi) = query.doi.as_ref() {
        let url = format!("https://api.crossref.org/works/{}", encode(doi.trim()));
        return Ok(get_json(state, &url)
            .await?
            .map(|body| crossref_record(&body["message"])));
    }

    let Some(title) = query.title.as_ref() else {
        return Ok(None);
    };
    let mut url = format!(
        "https://api.crossref.org/works?rows=3&select={}&query.bibliographic={}",
        encode("title,author,publisher,container-title,issued,is-referenced-by-count,type,update-to,DOI"),
        encode(title.trim())
    );
    if let Some(author) = query.first_author.as_ref() {
        url.push_str(&format!("&query.author={}", encode(author.trim())));
    }

    let Some(body) = get_json(state, &url).await? else {
        return Ok(None);
    };
    let best = body["message"]["items"]
        .as_array()
        .and_then(|items| {
            items
                .iter()
                .map(|item| {
                    let candidate = item["title"][0].as_str().unwrap_or_default();
                    (title_match(title, candidate), item)
                })
                .max_by(|a, b| a.0.total_cmp(&b.0))
        })
        .filter(|(score, _)| *score >= 0.6)
        .map(|(_, item)| crossref_record(item));
    Ok(best)
}

async fn lookup_openalex(state: &AppState, query: &SourceQuery) -> CoreResult<Option<Record>> {
    if let Some(doi) = query.doi.as_ref() {
        let url = format!("https://api.openalex.org/works/doi:{}", encode(doi.trim()));
        return Ok(get_json(state, &url).await?.map(|body| openalex_record(&body)));
    }

    let Some(title) = query.title.as_ref() else {
        return Ok(None);
    };
    let url = format!(
        "https://api.openalex.org/works?per-page=3&filter=title.search:{}",
        encode(title.trim())
    );
    let Some(body) = get_json(state, &url).await? else {
        return Ok(None);
    };
    let best = body["results"]
        .as_array()
        .and_then(|items| {
            items
                .iter()
                .map(|item| {
                    let candidate = item["display_name"].as_str().unwrap_or_default();
                    (title_match(title, candidate), item)
                })
                .max_by(|a, b| a.0.total_cmp(&b.0))
        })
        .filter(|(score, _)| *score >= 0.6)
        .map(|(_, item)| openalex_record(item));
    Ok(best)
}

/// Verify one source. Returns a verdict rather than an error for "not found",
/// because an unfindable citation is a finding, not a failure.
#[tauri::command]
pub async fn verify_source(
    state: State<'_, AppState>,
    query: SourceQuery,
) -> CoreResult<AuthenticityVerdict> {
    let checked_at = chrono::Utc::now().to_rfc3339();
    let mut registries: Vec<String> = Vec::new();
    let mut flags: Vec<String> = Vec::new();

    let crossref = match lookup_crossref(&state, &query).await {
        Ok(record) => record,
        Err(error) => {
            flags.push(format!("Crossref lookup failed: {error}"));
            None
        }
    };
    if crossref.is_some() {
        registries.push("crossref".into());
    }

    let openalex = match lookup_openalex(&state, &query).await {
        Ok(record) => record,
        Err(error) => {
            flags.push(format!("OpenAlex lookup failed: {error}"));
            None
        }
    };
    if openalex.is_some() {
        registries.push("openalex".into());
    }

    let merged = match (&crossref, &openalex) {
        (Some(cr), Some(oa)) => Record {
            title: cr.title.clone().or_else(|| oa.title.clone()),
            publisher: cr.publisher.clone().or_else(|| oa.publisher.clone()),
            container_title: cr
                .container_title
                .clone()
                .or_else(|| oa.container_title.clone()),
            year: cr.year.or(oa.year),
            cited_by_count: oa.cited_by_count.or(cr.cited_by_count),
            retracted: cr.retracted || oa.retracted,
            in_doaj: oa.in_doaj,
            // Both OA fields are OpenAlex-only, so they come from that side.
            is_open_access: oa.is_open_access,
            oa_status: oa.oa_status.clone(),
            // Prefer whichever registry gave the fuller author list.
            authors: if cr.authors.len() >= oa.authors.len() {
                cr.authors.clone()
            } else {
                oa.authors.clone()
            },
            work_type: cr.work_type.clone().or_else(|| oa.work_type.clone()),
            // Only a preprint if neither registry holds a published version.
            is_preprint: cr.is_preprint && oa.is_preprint,
            // Either registry asserting a retraction is enough: the two disagree
            // often, and a missed retraction is far worse than a redundant one.
            is_retraction_notice: cr.is_retraction_notice || oa.is_retraction_notice,
            retraction_notice_doi: cr
                .retraction_notice_doi
                .clone()
                .or_else(|| oa.retraction_notice_doi.clone()),
            retraction_date: cr.retraction_date.clone().or_else(|| oa.retraction_date.clone()),
            expression_of_concern: cr.expression_of_concern || oa.expression_of_concern,
        },
        (Some(record), None) | (None, Some(record)) => Record {
            title: record.title.clone(),
            publisher: record.publisher.clone(),
            container_title: record.container_title.clone(),
            year: record.year,
            cited_by_count: record.cited_by_count,
            retracted: record.retracted,
            in_doaj: record.in_doaj,
            is_open_access: record.is_open_access,
            oa_status: record.oa_status.clone(),
            authors: record.authors.clone(),
            work_type: record.work_type.clone(),
            is_preprint: record.is_preprint,
            is_retraction_notice: record.is_retraction_notice,
            retraction_notice_doi: record.retraction_notice_doi.clone(),
            retraction_date: record.retraction_date.clone(),
            expression_of_concern: record.expression_of_concern,
        },
        (None, None) => {
            let has_query = query.doi.is_some() || query.title.is_some();
            return Ok(AuthenticityVerdict {
                status: if has_query { "notFound".into() } else { "unverified".into() },
                score: if has_query { 10 } else { 50 },
                matched_title: None,
                publisher: None,
                container_title: None,
                year: None,
                cited_by_count: None,
                citations_per_year: None,
                citation_signal: None,
                is_open_access: false,
                oa_status: None,
                registry_authors: Vec::new(),
                work_type: None,
                is_preprint: false,
                title_overlap: None,
                is_retracted: false,
                is_retraction_notice: false,
                retraction_notice_doi: None,
                retraction_date: None,
                has_expression_of_concern: false,
                is_indexed_in_doaj: false,
                registries,
                flags: {
                    flags.push(if has_query {
                        "Neither Crossref nor OpenAlex holds a record matching this reference. Treat as potentially hallucinated or predatory until the student produces the source."
                            .into()
                    } else {
                        "Not enough metadata to run a lookup.".into()
                    });
                    flags
                },
                checked_at,
            });
        }
    };

    // Scoring: start from "indexed somewhere", then reward corroboration.
    let mut score: i64 = 62;
    if registries.len() == 2 {
        score += 14;
    } else {
        flags.push(format!(
            "Only {} holds a record for this source.",
            registries.first().cloned().unwrap_or_default()
        ));
    }
    if merged.publisher.is_some() {
        score += 8;
    } else {
        flags.push("No publisher is recorded for this source.".into());
    }
    if merged.in_doaj {
        score += 6;
    }

    // Citation counts accumulate with age, so a flat cutoff structurally
    // penalises recent work: a paper published this year cannot have reached the
    // count a 2015 one has, however sound it is. Two changes follow from that.
    // First, judge the *rate* rather than the total. Second, inside the indexing
    // lag window decline to judge at all - registries backfill citing works for
    // months after publication, so an empty count there is an artefact of
    // timing, not a property of the source.
    //
    // The adjustment stays bonus-only, as it was: being uncited is not evidence
    // of being fabricated, and this axis only asks whether the source exists and
    // is reputably indexed. A low rate therefore costs nothing.
    //
    // Note that "decline to judge" cannot mean "withhold the bonus": in a
    // bonus-only scheme that is itself the age penalty, just moved. So a recent
    // work that has already been cited earns the same credit on the strength of
    // that uptake, without its rate being extrapolated from a partial year.
    // Publication data is year-granular, so the window is expressed in years:
    // 1 covers everything from roughly 6 to 24 months old, depending on where in
    // the year the work appeared.
    const CITATION_LAG_YEARS: i64 = 1;
    // At least this many citations per year to earn the corroboration bonus.
    const HEALTHY_CITATION_RATE: f64 = 1.0;
    let current_year = i64::from(chrono::Utc::now().year());
    let age_years = merged.year.map(|year| (current_year - year).max(0));
    let mut citations_per_year: Option<f64> = None;
    let mut citation_signal: Option<String> = None;
    match (merged.cited_by_count, age_years) {
        (Some(count), Some(age)) if age <= CITATION_LAG_YEARS => {
            if count > 0 {
                score += 6;
                citation_signal = Some("earlyUptake".into());
            } else {
                citation_signal = Some("tooRecent".into());
            }
        }
        (Some(count), Some(age)) => {
            // `age` is at least CITATION_LAG_YEARS + 1 here, so never zero.
            let rate = count as f64 / age as f64;
            citations_per_year = Some((rate * 10.0).round() / 10.0);
            if rate >= HEALTHY_CITATION_RATE {
                score += 6;
                citation_signal = Some("wellCited".into());
            } else if count == 0 {
                citation_signal = Some("uncited".into());
            } else {
                citation_signal = Some("sparse".into());
            }
        }
        // No year, or no count: nothing interpretable, so no adjustment.
        _ => {}
    }

    if let (Some(claimed), Some(found)) = (query.year, merged.year) {
        if (claimed - found).abs() > 1 {
            score -= 12;
            flags.push(format!(
                "Year mismatch: the report cites {claimed}, the registry records {found}."
            ));
        }
    }
    let mut title_overlap: Option<f64> = None;
    if let (Some(claimed), Some(found)) = (query.title.as_ref(), merged.title.as_ref()) {
        let ratio = title_match(claimed, found);
        title_overlap = Some(ratio);
        if ratio < 0.75 {
            score -= 16;
            flags.push(format!(
                "Title differs from the registry record (overlap {:.0}%): \"{}\".",
                ratio * 100.0,
                found
            ));
        }
        // An identifier that resolves to an unrelated work is a harder fault than
        // a loose title match, and must not be reported as verified.
        if ratio < 0.5 && query.doi.is_some() {
            score = score.min(35);
        }
    }

    let mut status = "verified";
    if merged.retracted {
        status = "suspicious";
        score = score.min(25);
        flags.push(format!(
            "This work was retracted{}{}. It cannot carry supporting evidence.",
            merged
                .retraction_date
                .as_ref()
                .map(|date| format!(" on {date}"))
                .unwrap_or_default(),
            merged
                .retraction_notice_doi
                .as_ref()
                .map(|doi| format!(" (notice: {doi})"))
                .unwrap_or_default(),
        ));
    }
    if merged.is_retraction_notice {
        score = score.min(45);
        flags.push(
            "This record is a retraction notice, not the study it retracts. Findings cannot be attributed to it."
                .into(),
        );
    }
    if merged.expression_of_concern && !merged.retracted {
        score -= 20;
        flags.push(
            "An expression of concern has been issued about this work: the journal has publicly questioned it."
                .into(),
        );
    }
    if score < 55 {
        status = "suspicious";
    }

    Ok(AuthenticityVerdict {
        status: status.into(),
        score: score.clamp(0, 100),
        matched_title: merged.title,
        publisher: merged.publisher,
        container_title: merged.container_title,
        registry_authors: merged.authors,
        work_type: merged.work_type,
        is_preprint: merged.is_preprint,
        title_overlap,
        year: merged.year,
        cited_by_count: merged.cited_by_count,
        citations_per_year,
        citation_signal,
        is_open_access: merged.is_open_access,
        oa_status: merged.oa_status,
        is_retracted: merged.retracted,
        is_retraction_notice: merged.is_retraction_notice,
        retraction_notice_doi: merged.retraction_notice_doi,
        retraction_date: merged.retraction_date,
        has_expression_of_concern: merged.expression_of_concern,
        is_indexed_in_doaj: merged.in_doaj,
        registries,
        flags,
        checked_at,
    })
}
