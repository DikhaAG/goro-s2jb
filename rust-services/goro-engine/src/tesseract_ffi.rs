use std::ffi::{CStr, CString};
use std::os::raw::{c_char, c_int, c_uchar};
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex};
use tokio::sync::{OwnedSemaphorePermit, Semaphore};
use tracing::info;

#[repr(C)]
pub struct TessBaseAPI {
    _private: [u8; 0],
}

#[repr(C)]
#[derive(Debug, Clone, Copy)]
pub enum TessPageSegMode {
    OsdOnly = 0,
    AutoOsd = 1,
    AutoOnly = 2,
    Auto = 3,
    SingleColumn = 4,
    SingleBlockVertText = 5,
    SingleBlock = 6,
    SingleLine = 7,
    SingleWord = 8,
    CircleWord = 9,
    SingleChar = 10,
    SparseText = 11,
    SparseTextOsd = 12,
    RawLine = 13,
}

unsafe extern "C" {
    fn TessVersion() -> *const c_char;
    fn TessBaseAPICreate() -> *mut TessBaseAPI;
    fn TessBaseAPIDelete(handle: *mut TessBaseAPI);
    fn TessBaseAPIInit3(
        handle: *mut TessBaseAPI,
        datapath: *const c_char,
        language: *const c_char,
    ) -> c_int;
    fn TessBaseAPISetImage(
        handle: *mut TessBaseAPI,
        imagedata: *const c_uchar,
        width: c_int,
        height: c_int,
        bytes_per_pixel: c_int,
        bytes_per_line: c_int,
    );
    fn TessBaseAPISetPageSegMode(handle: *mut TessBaseAPI, mode: c_int);
    fn TessBaseAPIGetUTF8Text(handle: *mut TessBaseAPI) -> *mut c_char;
    fn TessDeleteText(text: *mut c_char);
    fn TessBaseAPIClear(handle: *mut TessBaseAPI);
    fn TessBaseAPIEnd(handle: *mut TessBaseAPI);
}

/// Locates the appropriate tessdata directory containing trained models.
pub fn find_tessdata_path() -> Option<PathBuf> {
    if let Ok(env_path) = std::env::var("TESSDATA_PREFIX") {
        let p = PathBuf::from(env_path);
        if p.exists() {
            return Some(p);
        }
    }

    let candidates = [
        "rust-services/goro-engine/tessdata",
        "tessdata",
        "../tessdata",
        "../../rust-services/goro-engine/tessdata",
        "/opt/homebrew/share/tessdata",
        "/usr/share/tesseract-ocr/5/tessdata",
        "/usr/share/tesseract-ocr/4.00/tessdata",
        "/usr/share/tessdata",
        "/usr/local/share/tessdata",
        "python-services/ocr/tessdata",
        "../../python-services/ocr/tessdata",
    ];

    for c in &candidates {
        let p = Path::new(c);
        if p.exists() && p.join("eng.traineddata").exists() {
            return Some(p.to_path_buf());
        }
    }

    None
}

/// Returns the linked Tesseract C library version.
pub fn get_tesseract_version() -> String {
    unsafe {
        let ptr = TessVersion();
        if ptr.is_null() {
            "Unknown".to_string()
        } else {
            CStr::from_ptr(ptr).to_string_lossy().into_owned()
        }
    }
}

/// Safe Rust wrapper around a single `TessBaseAPI` C instance.
pub struct TesseractEngine {
    api: *mut TessBaseAPI,
}

unsafe impl Send for TesseractEngine {}

impl TesseractEngine {
    /// Creates and initializes a new Tesseract in-memory instance.
    pub fn new(lang: &str) -> Result<Self, String> {
        let api = unsafe { TessBaseAPICreate() };
        if api.is_null() {
            return Err("Failed to allocate TessBaseAPI instance".to_string());
        }

        let datapath_buf = find_tessdata_path();
        let datapath_cstr = match &datapath_buf {
            Some(p) => CString::new(p.to_string_lossy().as_bytes())
                .map_err(|e| format!("Invalid datapath CString: {}", e))?,
            None => CString::new("").unwrap(),
        };

        let lang_cstr = CString::new(lang)
            .map_err(|e| format!("Invalid language CString: {}", e))?;

        let datapath_ptr = if datapath_buf.is_some() {
            datapath_cstr.as_ptr()
        } else {
            std::ptr::null()
        };

        let init_res = unsafe {
            TessBaseAPIInit3(api, datapath_ptr, lang_cstr.as_ptr())
        };

        if init_res != 0 {
            // Fallback: try English only if combined "ind+eng" is missing or failed
            let fallback_lang = CString::new("eng").unwrap();
            let retry = unsafe {
                TessBaseAPIInit3(api, datapath_ptr, fallback_lang.as_ptr())
            };
            if retry != 0 {
                unsafe { TessBaseAPIDelete(api) };
                return Err(format!("TessBaseAPIInit3 failed with error code: {}", init_res));
            }
        }

        Ok(Self { api })
    }

    /// Sets raw grayscale or RGB image pointer in memory. Zero-disk, direct RAM pass.
    pub fn set_image(&mut self, image_bytes: &[u8], width: u32, height: u32, bytes_per_pixel: u32) {
        let bytes_per_line = width * bytes_per_pixel;
        unsafe {
            TessBaseAPISetImage(
                self.api,
                image_bytes.as_ptr(),
                width as c_int,
                height as c_int,
                bytes_per_pixel as c_int,
                bytes_per_line as c_int,
            );
        }
    }

    /// Sets the Page Segmentation Mode (PSM).
    pub fn set_page_seg_mode(&mut self, mode: TessPageSegMode) {
        unsafe {
            TessBaseAPISetPageSegMode(self.api, mode as c_int);
        }
    }

    /// Performs OCR recognition and returns extracted UTF-8 text.
    pub fn get_utf8_text(&mut self) -> Result<String, String> {
        unsafe {
            let text_ptr = TessBaseAPIGetUTF8Text(self.api);
            if text_ptr.is_null() {
                return Ok(String::new());
            }
            let cstr = CStr::from_ptr(text_ptr);
            let result = cstr.to_string_lossy().into_owned();
            TessDeleteText(text_ptr);
            TessBaseAPIClear(self.api);
            Ok(result)
        }
    }
}

impl Drop for TesseractEngine {
    fn drop(&mut self) {
        unsafe {
            if !self.api.is_null() {
                TessBaseAPIEnd(self.api);
                TessBaseAPIDelete(self.api);
            }
        }
    }
}

/// Returns a borrowed engine back to the pool before releasing its semaphore permit.
struct PoolEngineGuard {
    engine: Option<TesseractEngine>,
    engines: Arc<Mutex<Vec<TesseractEngine>>>,
    // Declared last so Drop::drop pushes the engine back before the permit frees a slot.
    _permit: OwnedSemaphorePermit,
}

impl Drop for PoolEngineGuard {
    fn drop(&mut self) {
        if let Some(engine) = self.engine.take() {
            let mut guard = self.engines.lock().unwrap_or_else(|e| e.into_inner());
            guard.push(engine);
        }
    }
}

/// Thread-safe worker pool managing in-memory Tesseract instances.
#[derive(Clone)]
pub struct TesseractPool {
    semaphore: Arc<Semaphore>,
    engines: Arc<Mutex<Vec<TesseractEngine>>>,
}

impl TesseractPool {
    /// Creates a pool of warm Tesseract engines matching CPU concurrency.
    pub fn new(size: usize, lang: &str) -> Result<Self, String> {
        let pool_size = size.max(1);
        let mut engines = Vec::with_capacity(pool_size);

        for _ in 0..pool_size {
            let engine = TesseractEngine::new(lang)?;
            engines.push(engine);
        }

        info!("In-Memory Tesseract Pool initialized with {} warm instance(s) [Version: {}]", pool_size, get_tesseract_version());
        Ok(Self {
            semaphore: Arc::new(Semaphore::new(pool_size)),
            engines: Arc::new(Mutex::new(engines)),
        })
    }

    /// Acquires any available engine from the pool and runs OCR on Tokio's blocking thread pool.
    pub async fn run_ocr<F, R>(&self, f: F) -> Result<R, String>
    where
        F: FnOnce(&mut TesseractEngine) -> Result<R, String> + Send + 'static,
        R: Send + 'static,
    {
        let permit = self
            .semaphore
            .clone()
            .acquire_owned()
            .await
            .map_err(|_| "OCR engine pool closed".to_string())?;

        let engines = Arc::clone(&self.engines);
        tokio::task::spawn_blocking(move || {
            let engine = {
                let mut guard = engines.lock().unwrap_or_else(|e| e.into_inner());
                guard
                    .pop()
                    .ok_or_else(|| "No Tesseract engine available in pool".to_string())?
            };

            let mut engine_guard = PoolEngineGuard {
                engine: Some(engine),
                engines,
                _permit: permit,
            };

            let engine_ref = engine_guard
                .engine
                .as_mut()
                .ok_or_else(|| "Missing Tesseract engine instance".to_string())?;

            f(engine_ref)
        })
        .await
        .map_err(|e| format!("OCR worker task failed: {e}"))?
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_version_available() {
        let version = get_tesseract_version();
        assert!(!version.is_empty());
        assert_ne!(version, "Unknown");
    }

    #[test]
    fn test_engine_initialization() {
        let engine = TesseractEngine::new("ind+eng");
        assert!(engine.is_ok(), "Engine should initialize with ind+eng or fallback to eng");
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 2)]
    async fn pool_schedules_all_engines_concurrently() {
        let pool = TesseractPool::new(2, "eng").expect("2-slot pool should initialize");
        let barrier = Arc::new(std::sync::Barrier::new(2));

        let b1 = Arc::clone(&barrier);
        let p1 = pool.clone();
        let t1 = tokio::spawn(async move {
            p1.run_ocr(move |_| {
                b1.wait();
                Ok(1)
            })
            .await
        });

        let b2 = Arc::clone(&barrier);
        let p2 = pool.clone();
        let t2 = tokio::spawn(async move {
            p2.run_ocr(move |_| {
                b2.wait();
                Ok(2)
            })
            .await
        });

        let (r1, r2) = tokio::time::timeout(std::time::Duration::from_secs(3), async {
            tokio::join!(t1, t2)
        })
        .await
        .expect("both pool slots should execute in parallel without deadlocking at barrier");

        assert_eq!(r1.expect("task 1 join").expect("task 1 ocr"), 1);
        assert_eq!(r2.expect("task 2 join").expect("task 2 ocr"), 2);
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn pool_reclaims_engine_and_permit_after_task_panic() {
        let pool = TesseractPool::new(1, "eng").expect("1-slot pool should initialize");

        let panic_res: Result<(), String> = pool
            .run_ocr(|_| -> Result<(), String> {
                panic!("simulated FFI panic");
            })
            .await;
        assert!(panic_res.is_err(), "panic inside blocking task should surface as Err");

        // The single engine and semaphore permit must both have been returned cleanly.
        let next_res = tokio::time::timeout(
            std::time::Duration::from_secs(2),
            pool.run_ocr(|_| Ok(42)),
        )
        .await
        .expect("subsequent run_ocr should not hang after panic")
        .expect("reclaimed engine should work");

        assert_eq!(next_res, 42);
    }
}
