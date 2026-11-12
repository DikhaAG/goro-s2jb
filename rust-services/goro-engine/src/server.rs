use crate::duplicate_matcher::{evaluate_batch_duplicate, BatchDuplicateRequest, BatchDuplicateResponse};
use crate::engine::extract_text_with_auto_orientation;
use crate::hasher::{calculate_phash, hamming_distance, is_visual_duplicate};
use crate::tesseract_ffi::{get_tesseract_version, TesseractPool};
use axum::{
    extract::{State, Json},
    routing::{get, post},
    Router,
};
use base64::Engine;
use image::DynamicImage;
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use std::time::{Instant, SystemTime, UNIX_EPOCH};
use tower_http::cors::CorsLayer;
use tracing::info;

#[derive(Clone)]
pub struct AppState {
    pub pool: Arc<TesseractPool>,
    pub start_time: Instant,
}

#[derive(Debug, Deserialize)]
pub struct ProcessRequest {
    pub image_path: Option<String>,
    pub image_base64: Option<String>,
    #[serde(default)]
    pub target_name: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ProcessResponse {
    pub success: bool,
    pub extracted_text: String,
    pub phash: String,
    pub similarity_score: f64,
    pub zone: String,
    pub recommended_status: String,
    pub execution_time_ms: u64,
    pub error: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct CompareHashRequest {
    pub hash1: String,
    pub hash2: String,
    pub max_distance: Option<u32>,
}

#[derive(Debug, Deserialize)]
pub struct MatchRequest {
    pub target_name: String,
    pub extracted_text: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct MatchResponse {
    pub score: f64,
    pub zone: String,
    pub status: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CompareHashResponse {
    pub hamming_distance: u32,
    pub is_duplicate: bool,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct HealthResponse {
    pub status: String,
    pub service: String,
    pub engine: String,
    pub version: String,
    pub tesseract_version: String,
    pub uptime_seconds: u64,
    pub timestamp: f64,
}

/// Loads a DynamicImage from either a file path or a base64 encoded byte stream.
pub fn load_image(image_path: Option<&str>, image_base64: Option<&str>) -> Result<DynamicImage, String> {
    if let Some(b64) = image_base64 {
        let clean_b64 = b64.trim();
        let data = if let Some(idx) = clean_b64.find(";base64,") {
            &clean_b64[idx + 8..]
        } else {
            clean_b64
        };
        let decoded = base64::engine::general_purpose::STANDARD
            .decode(data)
            .map_err(|e| format!("Base64 decode error: {e}"))?;
        let img = image::load_from_memory(&decoded)
            .map_err(|e| format!("Image format decode error: {e}"))?;
        Ok(img)
    } else if let Some(path) = image_path {
        if !std::path::Path::new(path).exists() {
            return Err(format!("Image file not found: {path}"));
        }
        let img = image::open(path)
            .map_err(|e| format!("Failed to open image file {path}: {e}"))?;
        Ok(img)
    } else {
        Err("Neither image_path nor image_base64 was provided".to_string())
    }
}

/// Processes an evidence image by running multi-pass OCR and perceptual hash calculation.
pub async fn process_evidence(
    pool: &TesseractPool,
    image_path: Option<&str>,
    image_base64: Option<&str>,
    target_name: &str,
) -> ProcessResponse {
    let start = Instant::now();
    let path_owned = image_path.map(str::to_owned);
    let b64_owned = image_base64.map(str::to_owned);

    // Offload file I/O, base64 decoding, and image decompression away from async worker threads.
    let img = match tokio::task::spawn_blocking(move || {
        load_image(path_owned.as_deref(), b64_owned.as_deref())
    })
    .await
    {
        Ok(Ok(img)) => img,
        Ok(Err(err)) => {
            return ProcessResponse {
                success: false,
                extracted_text: String::new(),
                phash: String::new(),
                similarity_score: 0.0,
                zone: "RED".to_string(),
                recommended_status: "REJECTED".to_string(),
                execution_time_ms: start.elapsed().as_millis() as u64,
                error: Some(err),
            };
        }
        Err(join_err) => {
            return ProcessResponse {
                success: false,
                extracted_text: String::new(),
                phash: String::new(),
                similarity_score: 0.0,
                zone: "RED".to_string(),
                recommended_status: "REJECTED".to_string(),
                execution_time_ms: start.elapsed().as_millis() as u64,
                error: Some(format!("Image loader task failed: {join_err}")),
            };
        }
    };

    let target = target_name.to_string();
    let ocr_result = pool
        .run_ocr(move |engine| {
            let (extracted_text, score, zone, status, best_img) =
                extract_text_with_auto_orientation(engine, &img, &target);
            let phash = calculate_phash(&best_img);
            Ok((extracted_text, score, zone, status, phash))
        })
        .await;

    match ocr_result {
        Ok((extracted_text, score, zone, status, phash)) => ProcessResponse {
            success: true,
            extracted_text,
            phash,
            similarity_score: score,
            zone: zone.to_string(),
            recommended_status: status.to_string(),
            execution_time_ms: start.elapsed().as_millis() as u64,
            error: None,
        },
        Err(err) => ProcessResponse {
            success: false,
            extracted_text: String::new(),
            phash: String::new(),
            similarity_score: 0.0,
            zone: "RED".to_string(),
            recommended_status: "REJECTED".to_string(),
            execution_time_ms: start.elapsed().as_millis() as u64,
            error: Some(err),
        },
    }
}

pub async fn health_handler(State(state): State<AppState>) -> Json<HealthResponse> {
    let uptime = state.start_time.elapsed().as_secs();
    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs_f64();

    Json(HealthResponse {
        status: "UP".to_string(),
        service: "GORO S2JB OCR Vision Core".to_string(),
        engine: "rust-native-goro-engine".to_string(),
        version: env!("CARGO_PKG_VERSION").to_string(),
        tesseract_version: get_tesseract_version(),
        uptime_seconds: uptime,
        timestamp: now,
    })
}

pub async fn process_handler(
    State(state): State<AppState>,
    Json(payload): Json<ProcessRequest>,
) -> Json<ProcessResponse> {
    let target = payload.target_name.as_deref().unwrap_or("");
    let response = process_evidence(
        &state.pool,
        payload.image_path.as_deref(),
        payload.image_base64.as_deref(),
        target,
    )
    .await;
    Json(response)
}

pub async fn compare_hash_handler(
    Json(payload): Json<CompareHashRequest>,
) -> Json<CompareHashResponse> {
    let dist = hamming_distance(&payload.hash1, &payload.hash2);
    let max_dist = payload.max_distance.unwrap_or(5);
    let is_dup = is_visual_duplicate(&payload.hash1, &payload.hash2, max_dist);

    Json(CompareHashResponse {
        hamming_distance: dist,
        is_duplicate: is_dup,
    })
}

pub async fn match_handler(
    Json(payload): Json<MatchRequest>,
) -> Json<MatchResponse> {
    let (score, zone, status) = crate::matcher::calculate_similarity(&payload.target_name, &payload.extracted_text);
    Json(MatchResponse {
        score,
        zone: zone.to_string(),
        status: status.to_string(),
    })
}

pub async fn batch_duplicate_check_handler(
    Json(payload): Json<BatchDuplicateRequest>,
) -> Json<BatchDuplicateResponse> {
    let result = tokio::task::spawn_blocking(move || evaluate_batch_duplicate(payload))
        .await
        .unwrap_or_else(|err| {
            tracing::error!("Batch duplicate check task failed: {err}");
            BatchDuplicateResponse {
                is_duplicate: false,
                duplicate_of_id: None,
                min_distance: 64,
                visual_similarity: 0,
                text_similarity: 0,
                reviewer_similarity: 0,
                match_reason: None,
                execution_time_ms: 0,
            }
        });
    Json(result)
}

/// Creates the Axum application router with all microservice endpoints.
pub fn create_router(state: AppState) -> Router {
    Router::new()
        .route("/health", get(health_handler))
        .route("/api/v1/process", post(process_handler))
        .route("/api/v1/compare-hash", post(compare_hash_handler))
        .route("/api/v1/match", post(match_handler))
        .route("/api/v1/batch-duplicate-check", post(batch_duplicate_check_handler))
        .layer(CorsLayer::permissive())
        .with_state(state)
}

/// Starts the Axum HTTP server on the specified host and port.
pub async fn start_server(pool: TesseractPool, host: &str, port: u16) -> Result<(), Box<dyn std::error::Error>> {
    let state = AppState {
        pool: Arc::new(pool),
        start_time: Instant::now(),
    };

    let app = create_router(state);
    let addr = format!("{}:{}", host, port);
    let listener = tokio::net::TcpListener::bind(&addr).await?;
    info!("🚀 GORO S2JB Rust Native Vision Engine listening on http://{}", addr);

    axum::serve(listener, app).await?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::time::Duration;
    use tokio::io::{AsyncReadExt, AsyncWriteExt};

    #[test]
    fn health_stays_responsive_while_ocr_runs_on_single_worker_runtime() {
        let rt = tokio::runtime::Builder::new_multi_thread()
            .worker_threads(1)
            .enable_all()
            .build()
            .expect("runtime should build");

        rt.block_on(async {
            let pool = TesseractPool::new(2, "eng").expect("pool should initialize");
            let state = AppState {
                pool: Arc::new(pool.clone()),
                start_time: Instant::now(),
            };

            let listener = tokio::net::TcpListener::bind("127.0.0.1:0")
                .await
                .expect("listener should bind");
            let addr = listener.local_addr().expect("addr should exist");
            let server_handle = tokio::spawn(async move {
                let _ = axum::serve(listener, create_router(state)).await;
            });

            // Signal as soon as the blocking OCR closure has started executing
            let (started_tx, started_rx) = tokio::sync::oneshot::channel();
            let ocr_pool = pool.clone();
            let ocr_handle = tokio::spawn(async move {
                let mut tx = Some(started_tx);
                ocr_pool
                    .run_ocr(move |_engine| {
                        if let Some(sender) = tx.take() {
                            let _ = sender.send(());
                        }
                        std::thread::sleep(Duration::from_millis(300));
                        Ok(())
                    })
                    .await
            });

            started_rx.await.expect("ocr job should start");

            let health_start = Instant::now();
            let response = tokio::time::timeout(Duration::from_millis(150), async {
                let mut stream = tokio::net::TcpStream::connect(addr).await?;
                stream
                    .write_all(b"GET /health HTTP/1.1\r\nHost: localhost\r\nConnection: close\r\n\r\n")
                    .await?;
                let mut buf = String::new();
                stream.read_to_string(&mut buf).await?;
                Ok::<String, std::io::Error>(buf)
            })
            .await
            .expect("/health timed out while OCR task blocked runtime")
            .expect("TCP read should succeed");

            let elapsed = health_start.elapsed();
            assert!(
                response.starts_with("HTTP/1.1 200 OK"),
                "unexpected health status: {response}"
            );
            assert!(
                response.contains("\"status\":\"UP\""),
                "unexpected health body: {response}"
            );
            assert!(
                elapsed < Duration::from_millis(150),
                "health took {:?} while OCR blocked",
                elapsed
            );

            ocr_handle.await.expect("ocr task panicked").expect("ocr failed");
            server_handle.abort();
        });
    }
}
