fn main() {
    println!("cargo:rerun-if-changed=build.rs");

    // 1. Try pkg-config first
    if let Ok(lib) = pkg_config::Config::new().probe("tesseract") {
        for path in lib.link_paths {
            println!("cargo:rustc-link-search=native={}", path.display());
        }
        for lib_name in lib.libs {
            println!("cargo:rustc-link-lib={}", lib_name);
        }
        if let Ok(lept) = pkg_config::Config::new().probe("lept") {
            for path in lept.link_paths {
                println!("cargo:rustc-link-search=native={}", path.display());
            }
            for lib_name in lept.libs {
                println!("cargo:rustc-link-lib={}", lib_name);
            }
        }
        return;
    }

    // 2. Fallback for macOS Homebrew / Linux standard paths
    let standard_dirs = [
        "/opt/homebrew/lib",
        "/usr/local/lib",
        "/usr/lib",
        "/usr/lib/x86_64-linux-gnu",
        "/usr/lib/aarch64-linux-gnu",
    ];

    for dir in &standard_dirs {
        if std::path::Path::new(dir).exists() {
            println!("cargo:rustc-link-search=native={}", dir);
        }
    }

    println!("cargo:rustc-link-lib=tesseract");
    println!("cargo:rustc-link-lib=lept");
}

