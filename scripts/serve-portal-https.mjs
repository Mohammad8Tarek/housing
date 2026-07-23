/**
 * serve-portal-https.mjs — HTTPS Server for Employee Portal PWA
 *
 * Usage: node scripts/serve-portal-https.mjs
 *
 * Serves the employee portal over HTTPS (self-signed cert)
 * so the PWA "Add to Home Screen" / "Install App" works on mobile.
 *
 * First run generates a self-signed RSA-2048 certificate via OpenSSL.
 */

import https from "node:https";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";
import os from "node:os";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const DIST = path.join(ROOT, "artifacts", "employee-portal", "dist");
const CERT_DIR = path.join(__dirname, ".certs");
const KEY_PATH = path.join(CERT_DIR, "key.pem");
const CERT_PATH = path.join(CERT_DIR, "cert.pem");
const PORT = 10443;
const API_PORT = 4000;

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".webmanifest": "application/manifest+json",
  ".json": "application/json",
};

// ─── Generate self-signed cert using pure Node.js (no OpenSSL needed) ──────
function ensureCert() {
  fs.mkdirSync(CERT_DIR, { recursive: true });
  if (fs.existsSync(KEY_PATH) && fs.existsSync(CERT_PATH)) {
    return { key: fs.readFileSync(KEY_PATH), cert: fs.readFileSync(CERT_PATH) };
  }

  // Use pure Node.js cert generator (no OpenSSL needed)
  try {
    execSync(`node "${path.join(__dirname, "gen-cert.mjs")}"`, { stdio: "pipe", timeout: 15000 });
    if (fs.existsSync(KEY_PATH) && fs.existsSync(CERT_PATH)) {
      console.log("  ✓ Certificate generated (pure Node.js)");
      return { key: fs.readFileSync(KEY_PATH), cert: fs.readFileSync(CERT_PATH) };
    }
  } catch {}

  console.error("  ❌ Could not generate certificate.");
  process.exit(1);
}

async function waitForApi() {
  for (let i = 0; i < 30; i++) {
    try { const r = await fetch(`http://localhost:${API_PORT}/api/healthz`); if (r.ok) return true; } catch {}
    await new Promise(r => setTimeout(r, 1000));
  }
  return false;
}

async function main() {
  console.log("");
  console.log("  ════════════════════════════════════════════");
  console.log("   Sunrise Housing — Employee Portal (HTTPS)");
  console.log("  ════════════════════════════════════════════");
  console.log("");

  if (!fs.existsSync(path.join(DIST, "index.html"))) {
    console.error("  ❌ Build not found at:", DIST);
    console.error("     cd artifacts/employee-portal && npx vite build");
    process.exit(1);
  }

  console.log("  ⏳ Checking API server...");
  if (await waitForApi()) console.log("  ✓ API ready on :4000");
  else console.log("  ⚠  API not found (start it separately)");

  console.log("  🔐 Loading certificate...");
  const cert = ensureCert();
  console.log("  ✓ Certificate ready");

  const server = https.createServer(cert, (req, res) => {
    const url = new URL(req.url || "/", `https://${req.headers.host}`);

    // API proxy
    if (url.pathname.startsWith("/api/")) {
      const fwdHeaders = { ...req.headers };
      delete fwdHeaders.host;
      delete fwdHeaders["content-length"];
      delete fwdHeaders["transfer-encoding"];
      delete fwdHeaders["accept-encoding"];
      delete fwdHeaders.connection;

      const opts = {
        hostname: "localhost", port: API_PORT,
        path: url.pathname + url.search, method: req.method,
        headers: fwdHeaders,
      };
      const proxy = http.request(opts, (pr) => {
        const resHeaders = { ...pr.headers };
        delete resHeaders["transfer-encoding"];
        delete resHeaders["content-encoding"];
        res.writeHead(pr.statusCode || 200, resHeaders);
        pr.pipe(res);
      });
      proxy.on("error", () => { res.writeHead(502); res.end(""); });
      req.pipe(proxy);
      return;
    }

    // Static files
    let fp = path.join(DIST, url.pathname === "/" ? "index.html" : url.pathname);
    if (!fs.existsSync(fp)) fp = path.join(DIST, "index.html");
    const ext = path.extname(fp);
    const isPwa = fp.includes("registerSW") || fp.includes("sw.js") || fp.includes("workbox") || fp.includes("manifest");

    try {
      const c = fs.readFileSync(fp);
      const headers = { "Content-Type": MIME[ext] || "application/octet-stream", "Service-Worker-Allowed": "/" };
      if (isPwa) headers["Cache-Control"] = "no-store, no-cache, must-revalidate";
      res.writeHead(200, headers);
      res.end(c);
    } catch { res.writeHead(404); res.end("Not Found"); }
  });

  const localIP = Object.values(os.networkInterfaces())
    .flat().find(i => i?.family === "IPv4" && !i.internal)
    ?.address || "localhost";

  server.listen(PORT, "0.0.0.0", () => {
    console.log("");
    console.log("  ┌──────────────────────────────────────────────────────┐");
    console.log("  │  ✅  HTTPS Server Ready!                            │");
    console.log("  ├──────────────────────────────────────────────────────┤");
    console.log(`  │  Local:    https://localhost:${PORT}                 │`);
    console.log(`  │  Network:  https://${localIP}:${PORT}               │`);
    console.log("  ├──────────────────────────────────────────────────────┤");
    console.log("  │  📱 Open on your PHONE browser:                     │");
    console.log(`  │     https://${localIP}:${PORT}                      │`);
    console.log("  │                                                      │");
    console.log("  │  1. Accept the 'Not Secure' warning:                │");
    console.log("  │     Advanced → Proceed anyway                       │");
    console.log("  │                                                      │");
    console.log("  │  2. Then the browser will show 'Install App':       │");
    console.log("  │     Chrome: tap '⋮' → Install app                   │");
    console.log("  │     Safari: tap Share → Add to Home Screen          │");
    console.log("  └──────────────────────────────────────────────────────┘");
    console.log("");
  });
}

main().catch(console.error);
