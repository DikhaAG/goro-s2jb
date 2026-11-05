#!/usr/bin/env node
/**
 * GORO S2JB - Universal Cross-Platform Setup Dispatcher
 * Otomatis mendeteksi sistem operasi (macOS, Linux, Windows)
 * dan memicu setup native yang sesuai dalam 1 perintah.
 */

const { spawn } = require("child_process");
const path = require("path");

const platform = process.platform;
const scriptsDir = __dirname;

console.log("\x1b[36m%s\x1b[0m", "==================================================================");
console.log("\x1b[36m%s\x1b[0m", "       ⚡ GORO S2JB - UNIVERSAL SETUP DISPATCHER                 ");
console.log("\x1b[36m%s\x1b[0m", "==================================================================");
console.log(`Terdeteksi Platform: \x1b[32m${platform}\x1b[0m\n`);

let child;

if (platform === "win32") {
  const scriptPath = path.join(scriptsDir, "setup-windows.ps1");
  console.log(`Menjalankan setup Windows PowerShell: ${scriptPath}`);
  child = spawn("powershell.exe", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", scriptPath], {
    stdio: "inherit",
    cwd: path.resolve(scriptsDir, ".."),
  });
} else if (platform === "darwin") {
  const scriptPath = path.join(scriptsDir, "setup-mac.sh");
  console.log(`Menjalankan setup macOS: ${scriptPath}`);
  child = spawn("bash", [scriptPath], {
    stdio: "inherit",
    cwd: path.resolve(scriptsDir, ".."),
  });
} else {
  // Linux and other POSIX
  const scriptPath = path.join(scriptsDir, "setup-linux.sh");
  console.log(`Menjalankan setup Linux: ${scriptPath}`);
  child = spawn("bash", [scriptPath], {
    stdio: "inherit",
    cwd: path.resolve(scriptsDir, ".."),
  });
}

function handleSignal(sig) {
  if (child && child.pid) {
    try {
      child.kill(sig);
    } catch {
      // ignore
    }
  }
}

process.on("SIGINT", () => handleSignal("SIGINT"));
process.on("SIGTERM", () => handleSignal("SIGTERM"));

child.on("exit", (code) => {
  process.exit(code ?? 0);
});

