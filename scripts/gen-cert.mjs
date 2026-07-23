// gen-cert.mjs — Generate a self-signed certificate using OpenSSL
import { execSync } from "node:child_process";
import { writeFileSync, mkdirSync, existsSync, statSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import os from "node:os";

const __dirname = dirname(fileURLToPath(import.meta.url));
const certDir = resolve(__dirname, ".certs");
const keyPath = resolve(certDir, "key.pem");
const certPath = resolve(certDir, "cert.pem");
mkdirSync(certDir, { recursive: true });

// Get machine LAN IP
function getLocalIP() {
  for (const ifaces of Object.values(os.networkInterfaces())) {
    for (const iface of ifaces) {
      if (iface.family === "IPv4" && !iface.internal) return iface.address;
    }
  }
  return "127.0.0.1";
}

const LOCAL_IP = getLocalIP();

// Skip if certs already exist and are recent (< 30 days)
if (existsSync(keyPath) && existsSync(certPath)) {
  const age = Date.now() - statSync(certPath).mtimeMs;
  if (age < 30 * 24 * 60 * 60 * 1000) {
    console.log("✅ Certificates already exist (< 30 days old)");
    console.log("   SAN: DNS:localhost, IP:" + LOCAL_IP);
    process.exit(0);
  }
}

const opensslPaths = [
  "C:\\Program Files\\Git\\mingw64\\bin\\openssl.exe",
  "openssl",
];

// Create SAN config
const sanConfig = `
[req]
distinguished_name = req_dn
x509_extensions = v3_req
prompt = no

[req_dn]
CN = localhost

[v3_req]
subjectAltName = @alt_names

[alt_names]
DNS.1 = localhost
IP.1 = ${LOCAL_IP}
`;

const configPath = resolve(certDir, "san.cnf");
writeFileSync(configPath, sanConfig);

let success = false;
for (const openssl of opensslPaths) {
  try {
    execSync(
      `"${openssl}" req -x509 -newkey rsa:2048 -nodes -keyout "${keyPath}" -out "${certPath}" -days 365 -config "${configPath}"`,
      { stdio: "pipe", timeout: 15000 }
    );
    if (existsSync(keyPath) && existsSync(certPath)) {
      success = true;
      break;
    }
  } catch {}
}

if (success) {
  console.log("✅ Self-signed certificate generated in", certDir);
  console.log("   SAN: DNS:localhost, IP:" + LOCAL_IP);
} else {
  console.error("❌ Could not generate certificate.");
  process.exit(1);
}
