use clap::Parser;
use goro_engine::server::{process_evidence, start_server};
use goro_engine::tesseract_ffi::TesseractPool;
use std::io::{self, Read};
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

#[derive(Parser, Debug)]
#[command(name = "goro-engine")]
#[command(version = env!("CARGO_PKG_VERSION"))]
#[command(about = "GORO S2JB Ultra-High Performance OCR & Anti-Fraud Engine")]
struct Cli {
    /// Path to evidence image file
    #[arg(long, value_name = "PATH")]
    image: Option<String>,

    /// Base64 encoded image or '-' to read from standard input
    #[arg(long, value_name = "BASE64")]
    base64: Option<String>,

    /// Expected reviewer name for fuzzy score matching
    #[arg(long, value_name = "NAME", default_value = "")]
    expected_name: String,

    /// Target reviewer name for isolated fuzzy text match evaluation
    #[arg(long, value_name = "TARGET")]
    match_target: Option<String>,

    /// Extracted text string for isolated fuzzy text match evaluation
    #[arg(long, value_name = "TEXT")]
    match_text: Option<String>,

    /// Force run as HTTP Axum microservice (default if no image/base64 is passed)
    #[arg(long)]
    server: bool,

    /// HTTP server bind host
    #[arg(long, default_value = "127.0.0.1")]
    host: String,

    /// HTTP server bind port
    #[arg(long, default_value_t = 8001)]
    port: u16,

    /// Number of warm Tesseract engine instances in worker pool
    #[arg(long)]
    threads: Option<usize>,

    /// Language models for OCR (e.g. "ind+eng")
    #[arg(long, default_value = "ind+eng")]
    lang: String,
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    tracing_subscriber::registry()
        .with(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "goro_engine=info,tower_http=info".into()),
        )
        .with(tracing_subscriber::fmt::layer())
        .init();

    let cli = Cli::parse();

    // Fast-path: Direct isolated fuzzy similarity evaluation without initializing Tesseract engine pool
    if let (Some(target), Some(text)) = (&cli.match_target, &cli.match_text) {
        let (score, zone, status) = goro_engine::matcher::calculate_similarity(target, text);
        let out = serde_json::json!({
            "score": score,
            "zone": zone,
            "status": status,
        });
        println!("{}", serde_json::to_string_pretty(&out)?);
        return Ok(());
    }

    let is_cli_mode = (cli.image.is_some() || cli.base64.is_some()) && !cli.server;

    // In CLI mode, a single worker instance is sufficient
    let worker_count = if is_cli_mode {
        1
    } else {
        cli.threads.unwrap_or_else(|| {
            std::thread::available_parallelism()
                .map(|p| p.get())
                .unwrap_or(4)
                .clamp(1, 16)
        })
    };

    let pool = TesseractPool::new(worker_count, &cli.lang)
        .map_err(|e| format!("Failed to initialize Tesseract pool: {e}"))?;

    if is_cli_mode {
        // Read stdin if base64 == "-"
        let b64_content = if let Some(ref b64) = cli.base64 {
            if b64 == "-" {
                let mut buffer = String::new();
                io::stdin().read_to_string(&mut buffer)?;
                Some(buffer.trim().to_string())
            } else {
                Some(b64.clone())
            }
        } else {
            None
        };

        let response = process_evidence(
            &pool,
            cli.image.as_deref(),
            b64_content.as_deref(),
            &cli.expected_name,
        )
        .await;

        println!("{}", serde_json::to_string_pretty(&response)?);
        if !response.success {
            std::process::exit(1);
        }
    } else {
        start_server(pool, &cli.host, cli.port).await?;
    }

    Ok(())
}
