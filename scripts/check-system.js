#!/usr/bin/env node
/**
 * GORO S2JB - Diagnostik Kesiapan Sistem Lintas Platform (Zero-Dependency)
 * Menggunakan modul bawaan Node.js (child_process, net, fs, path, os).
 * Dapat dijalankan langsung bahkan sebelum 'npm install' selesai.
 */

const { execSync } = require("child_process");
const net = require("net");
const fs = require("fs");
const path = require("path");
const os = require("os");

// ANSI Terminal Colors
const RESET = "\x1b[0m";
const BOLD = "\x1b[1m";
const GREEN = "\x1b[32m";
const YELLOW = "\x1b[33m";
const RED = "\x1b[31m";
const CYAN = "\x1b[36m";
const BLUE = "\x1b[34m";
const GRAY = "\x1b[90m";

const results = [];

function checkPort(port, host = "127.0.0.1", timeout = 600) {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    socket.setTimeout(timeout);
    socket.once("connect", () => {
      socket.destroy();
      resolve(true);
    });
    socket.once("timeout", () => {
      socket.destroy();
      resolve(false);
    });
    socket.once("error", () => {
      resolve(false);
    });
    socket.connect(port, host);
  });
}

function runCmd(cmd) {
  try {
    const stdout = execSync(cmd, { stdio: ["pipe", "pipe", "ignore"], encoding: "utf8" });
    return { success: true, stdout: stdout.trim() };
  } catch {
    return { success: false, stdout: "" };
  }
}

async function runSystemDiagnostics() {
  const platform = process.platform;
  const arch = process.arch;
  const projectRoot = process.cwd();

  console.log(`\n${CYAN}${BOLD}==================================================================${RESET}`);
  console.log(`${CYAN}${BOLD}     ⚡ GORO S2JB - DIAGNOSTIK KESIAPAN SISTEM LINTAS PLATFORM    ${RESET}`);
  console.log(`${CYAN}${BOLD}==================================================================${RESET}`);
  console.log(`${GRAY}Sistem Operasi : ${os.type()} (${platform}) ${os.release()} [${arch}]${RESET}`);
  console.log(`${GRAY}Total Memori   : ${Math.round(os.totalmem() / (1024 * 1024 * 1024))} GB (Tersedia: ${Math.round(os.freemem() / (1024 * 1024 * 1024))} GB)${RESET}`);
  console.log(`${GRAY}Waktu Pemeriksaan: ${new Date().toLocaleString("id-ID")}${RESET}\n`);

  // 1. Node.js Version
  const nodeVersion = process.version;
  const nodeMajor = parseInt(nodeVersion.replace("v", "").split(".")[0], 10);
  if (nodeMajor >= 20) {
    results.push({
      name: "Node.js Runtime",
      category: "Runtime",
      status: "PASS",
      details: `${nodeVersion} (LTS v20+ Terpenuhi)`,
      isMandatory: true,
    });
  } else {
    results.push({
      name: "Node.js Runtime",
      category: "Runtime",
      status: "FAIL",
      details: `${nodeVersion} (Diperlukan v20.x atau v22.x LTS)`,
      recommendation: "Perbarui Node.js dari https://nodejs.org atau via package manager",
      isMandatory: true,
    });
  }

  // 2. npm Package Manager
  const npmCheck = runCmd("npm --version");
  if (npmCheck.success) {
    results.push({
      name: "npm Package Manager",
      category: "Runtime",
      status: "PASS",
      details: `v${npmCheck.stdout}`,
      isMandatory: true,
    });
  } else {
    results.push({
      name: "npm Package Manager",
      category: "Runtime",
      status: "FAIL",
      details: "npm tidak ditemukan",
      recommendation: "Pasang npm bersamaan dengan Node.js",
      isMandatory: true,
    });
  }

  // 3. Node Modules Installation Check
  const nodeModulesPath = path.resolve(projectRoot, "node_modules");
  if (fs.existsSync(nodeModulesPath)) {
    results.push({
      name: "Dependensi Node.js",
      category: "Runtime",
      status: "PASS",
      details: "Folder node_modules tersedia",
      isMandatory: true,
    });
  } else {
    results.push({
      name: "Dependensi Node.js",
      category: "Runtime",
      status: "WARN",
      details: "Folder node_modules belum dipasang",
      recommendation: "Jalankan: npm run setup:all atau npm install",
      isMandatory: false,
    });
  }

  // 4. Rust & Cargo (Primary Native Engine)
  const cargoCheck = runCmd("cargo --version");
  const rustcCheck = runCmd("rustc --version");
  if (cargoCheck.success && rustcCheck.success) {
    results.push({
      name: "Rust & Cargo Compiler",
      category: "Compiler",
      status: "PASS",
      details: `${cargoCheck.stdout} | ${rustcCheck.stdout}`,
      isMandatory: true,
    });
  } else {
    results.push({
      name: "Rust & Cargo Compiler",
      category: "Compiler",
      status: "WARN",
      details: "Cargo/Rustc belum terdeteksi di PATH",
      recommendation: platform === "win32"
        ? "Pasang Rust via https://rustup.rs atau winget install Rustlang.Rustup"
        : platform === "darwin"
        ? "brew install rust atau curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh"
        : "sudo apt install -y cargo rustc atau curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh",
      isMandatory: false,
    });
  }

  // 5. Compiled Rust Engine Binary
  const isWindows = platform === "win32";
  const rustBinPath = path.resolve(
    projectRoot,
    "rust-services",
    "goro-engine",
    "target",
    "release",
    isWindows ? "goro-engine.exe" : "goro-engine"
  );
  if (fs.existsSync(rustBinPath)) {
    const binVer = runCmd(`"${rustBinPath}" --version`);
    results.push({
      name: "Biner Rilis goro-engine",
      category: "Vision",
      status: "PASS",
      details: `Siap dieksekusi: ${binVer.success ? binVer.stdout : "v0.1.0 rilis"}`,
      isMandatory: true,
    });
  } else {
    results.push({
      name: "Biner Rilis goro-engine",
      category: "Vision",
      status: "WARN",
      details: "Binary target/release/goro-engine belum dikompilasi",
      recommendation: "Jalankan perintah: npm run rust:build atau npm run setup:all",
      isMandatory: false,
    });
  }

  // 6. Tesseract OCR Engine
  const tessCheck = runCmd("tesseract --version");
  if (tessCheck.success) {
    const firstLine = tessCheck.stdout.split("\n")[0];
    const langCheck = runCmd("tesseract --list-langs");
    const hasInd = langCheck.stdout.includes("ind");
    const hasEng = langCheck.stdout.includes("eng");

    if (hasInd && hasEng) {
      results.push({
        name: "Tesseract OCR & Models",
        category: "Vision",
        status: "PASS",
        details: `${firstLine} (Model 'ind' & 'eng' terdeteksi)`,
        isMandatory: true,
      });
    } else {
      results.push({
        name: "Tesseract OCR & Models",
        category: "Vision",
        status: "WARN",
        details: `${firstLine} (Model ind: ${hasInd}, eng: ${hasEng})`,
        recommendation: platform === "darwin"
          ? "brew install tesseract-lang"
          : platform === "win32"
          ? "Pasang data bahasa Indonesia via installer Tesseract UB-Mannheim"
          : "sudo apt install -y tesseract-ocr-ind",
        isMandatory: false,
      });
    }
  } else {
    results.push({
      name: "Tesseract OCR Engine",
      category: "Vision",
      status: "WARN",
      details: "Perintah CLI tesseract tidak ditemukan di PATH",
      recommendation: platform === "darwin"
        ? "brew install tesseract tesseract-lang"
        : platform === "win32"
        ? "Unduh installer Tesseract dari UB-Mannheim dan tambahkan ke PATH"
        : "sudo apt install -y tesseract-ocr tesseract-ocr-ind libtesseract-dev",
      isMandatory: false,
    });
  }

  // 7. Local Tessdata Assets in rust-services
  const localTessdata = path.resolve(projectRoot, "rust-services", "goro-engine", "tessdata");
  const hasLocalInd = fs.existsSync(path.join(localTessdata, "ind.traineddata"));
  const hasLocalEng = fs.existsSync(path.join(localTessdata, "eng.traineddata"));
  if (hasLocalInd && hasLocalEng) {
    results.push({
      name: "Aset Mandiri tessdata Rust",
      category: "Vision",
      status: "PASS",
      details: "ind.traineddata dan eng.traineddata tersedia secara lokal",
      isMandatory: true,
    });
  } else {
    results.push({
      name: "Aset Mandiri tessdata Rust",
      category: "Vision",
      status: "WARN",
      details: `ind: ${hasLocalInd}, eng: ${hasLocalEng} di rust-services/goro-engine/tessdata/`,
      recommendation: "Salin traineddata ke rust-services/goro-engine/tessdata/",
      isMandatory: false,
    });
  }

  // 8. PostgreSQL Database Service
  const isPostgresUp = await checkPort(5432);
  if (isPostgresUp) {
    results.push({
      name: "PostgreSQL Database",
      category: "Database",
      status: "PASS",
      details: "Port 5432 aktif dan menerima koneksi soket TCP",
      isMandatory: true,
    });
  } else {
    results.push({
      name: "PostgreSQL Database",
      category: "Database",
      status: "FAIL",
      details: "Port 5432 tidak merespons",
      recommendation: platform === "darwin"
        ? "brew services start postgresql@16"
        : platform === "win32"
        ? "Nyalakan service PostgreSQL via Services.msc"
        : "sudo systemctl start postgresql",
      isMandatory: true,
    });
  }

  // 9. Redis In-Memory Service
  const isRedisUp = await checkPort(6379);
  if (isRedisUp) {
    results.push({
      name: "Redis Broker (BullMQ)",
      category: "Database",
      status: "PASS",
      details: "Port 6379 aktif dan menerima koneksi soket TCP",
      isMandatory: true,
    });
  } else {
    results.push({
      name: "Redis Broker (BullMQ)",
      category: "Database",
      status: "FAIL",
      details: "Port 6379 tidak merespons",
      recommendation: platform === "darwin"
        ? "brew services start redis"
        : platform === "win32"
        ? "Nyalakan service Redis atau gunakan docker run -p 6379:6379 redis:7-alpine"
        : "sudo systemctl start redis-server",
      isMandatory: true,
    });
  }

  // 10. Environment Configuration (.env)
  const envPath = path.resolve(projectRoot, ".env");
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, "utf8");
    const hasDbUrl = envContent.includes("DATABASE_URL");
    const hasRedisUrl = envContent.includes("REDIS_URL");
    if (hasDbUrl && hasRedisUrl) {
      results.push({
        name: "Konfigurasi .env",
        category: "Environment",
        status: "PASS",
        details: "Berkas .env lengkap (DATABASE_URL & REDIS_URL tersedia)",
        isMandatory: true,
      });
    } else {
      results.push({
        name: "Konfigurasi .env",
        category: "Environment",
        status: "WARN",
        details: "Sebagian variabel kunci (.env) belum terkonfigurasi",
        recommendation: "Periksa .env dan pastikan DATABASE_URL & REDIS_URL terisi",
        isMandatory: false,
      });
    }
  } else {
    results.push({
      name: "Konfigurasi .env",
      category: "Environment",
      status: "FAIL",
      details: "Berkas .env belum ada di direktori utama",
      recommendation: "Jalankan: cp .env.example .env",
      isMandatory: true,
    });
  }

  // 11. Docker & Docker Compose (Optional Containerization)
  const dockerCheck = runCmd("docker --version");
  const dockerComposeCheck = runCmd("docker compose version");
  if (dockerCheck.success && dockerComposeCheck.success) {
    results.push({
      name: "Docker & Docker Compose",
      category: "Environment",
      status: "PASS",
      details: `${dockerCheck.stdout} | ${dockerComposeCheck.stdout}`,
      isMandatory: false,
    });
  } else {
    results.push({
      name: "Docker & Docker Compose",
      category: "Environment",
      status: "WARN",
      details: "Docker Engine / Docker Compose belum terpasang (Opsional)",
      recommendation: "Dibutuhkan hanya jika ingin deployment zero-host dirt via Docker",
      isMandatory: false,
    });
  }

  // Print Table Output
  console.log(`${BOLD}HASIL DIAGNOSTIK SUBSISTEM:${RESET}`);
  console.log("--------------------------------------------------------------------------------");

  let failCount = 0;
  let warnCount = 0;

  for (const item of results) {
    let statusBadge = "";
    if (item.status === "PASS") {
      statusBadge = `${GREEN}[PASS]${RESET}`;
    } else if (item.status === "WARN") {
      statusBadge = `${YELLOW}[WARN]${RESET}`;
      warnCount++;
    } else {
      statusBadge = `${RED}[FAIL]${RESET}`;
      if (item.isMandatory) failCount++;
    }

    const catBadge = `${BLUE}[${item.category}]${RESET}`.padEnd(20);
    console.log(`${statusBadge} ${catBadge} ${BOLD}${item.name}${RESET}`);
    console.log(`       ${GRAY}Detail :${RESET} ${item.details}`);
    if (item.recommendation) {
      console.log(`       ${YELLOW}Solusi :${RESET} ${item.recommendation}`);
    }
    console.log("");
  }

  console.log("--------------------------------------------------------------------------------");
  if (failCount === 0) {
    console.log(`${GREEN}${BOLD}✓ SELURUH PRASYARAT KRITIS TERPENUHI!${RESET}`);
    console.log(`Sistem siap dijalankan di platform ${BOLD}${platform}${RESET}.`);
    console.log(`Gunakan perintah berikut untuk menyalakan sistem:`);
    console.log(`👉 ${CYAN}npm run start:all${RESET} (Peluncur lintas platform otomatis)\n`);
    process.exit(0);
  } else {
    console.log(`${RED}${BOLD}❌ DITEMUKAN ${failCount} KENDALA KRITIS PADA SISTEM!${RESET}`);
    console.log(`Harap perbaiki item bertanda [FAIL] di atas sebelum menjalankan aplikasi.\n`);
    process.exit(1);
  }
}

runSystemDiagnostics().catch((err) => {
  console.error("Kesalahan saat menjalankan diagnostik:", err);
  process.exit(1);
});

