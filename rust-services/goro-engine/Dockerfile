# ==============================================================================
# GORO S2JB - Rust Native Vision & Anti-Fraud Engine Dockerfile
# Multi-stage production build using Debian Bookworm Slim
# ==============================================================================

# Stage 1: Build binary with Rust & C libraries
FROM rust:1.85-bookworm AS builder

WORKDIR /usr/src/goro-engine

# Install build dependencies for C-FFI linking against libtesseract & liblept
RUN apt-get update && apt-get install -y --no-install-recommends \
    pkg-config \
    libtesseract-dev \
    libleptonica-dev \
    clang \
    && rm -rf /var/lib/apt/lists/*

# Copy build manifests and source code
COPY Cargo.toml build.rs ./
COPY src/ ./src/

# Compile release binary with full optimizations
RUN cargo build --release

# Stage 2: Minimal runtime image
FROM debian:bookworm-slim AS runner

WORKDIR /app

# Install runtime shared libraries, curl for healthcheck, and Tesseract trained models
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    curl \
    libtesseract5 \
    liblept5 \
    tesseract-ocr \
    tesseract-ocr-ind \
    tesseract-ocr-eng \
    && rm -rf /var/lib/apt/lists/*

# Configure Tesseract traineddata location
ENV TESSDATA_PREFIX=/usr/share/tesseract-ocr/5/tessdata
ENV RUST_LOG=info

# Create non-root user
RUN useradd -m -u 1001 -s /bin/bash appuser && chown -R appuser:appuser /app

# Copy binary from builder
COPY --from=builder /usr/src/goro-engine/target/release/goro-engine /usr/local/bin/goro-engine

USER appuser

EXPOSE 8001

HEALTHCHECK --interval=10s --timeout=3s --start-period=5s --retries=3 \
    CMD curl -f http://127.0.0.1:8001/health || exit 1

CMD ["goro-engine", "--host", "0.0.0.0", "--port", "8001"]

