use std::ffi::{CStr, CString};
use std::os::raw::{c_char, c_int, c_uchar};
use std::path::{Path, PathBuf};
use std::sync::Arc;
use tokio::sync::Mutex;
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

/// Thread-safe worker pool managing in-memory Tesseract instances.
#[derive(Clone)]
pub struct TesseractPool {
    instances: Arc<Vec<Mutex<TesseractEngine>>>,
}

impl TesseractPool {
    /// Creates a pool of warm Tesseract engines matching CPU concurrency.
    pub fn new(size: usize, lang: &str) -> Result<Self, String> {
        let pool_size = size.max(1);
        let mut engines = Vec::with_capacity(pool_size);

        for _ in 0..pool_size {
            let engine = TesseractEngine::new(lang)?;
            engines.push(Mutex::new(engine));
        }

        info!("In-Memory Tesseract Pool initialized with {} warm instance(s) [Version: {}]", pool_size, get_tesseract_version());
        Ok(Self {
            instances: Arc::new(engines),
        })
    }

    /// Acquires an available engine from the pool to process an image.
    pub async fn run_ocr<F, R>(&self, f: F) -> Result<R, String>
    where
        F: FnOnce(&mut TesseractEngine) -> Result<R, String>,
    {
        // Simple round-robin lock acquisition
        for instance in self.instances.iter() {
            if let Ok(mut guard) = instance.try_lock() {
                return f(&mut guard);
            }
        }

        // If all are busy, wait on the first available instance
        let mut guard = self.instances[0].lock().await;
        f(&mut guard)
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
}
