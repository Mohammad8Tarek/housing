/**
 * Sunrise Housing - Hotek Local Bridge
 * 
 * This script connects your local Hotek PMSServer (TCP) to your cloud Railway API (WebSocket).
 * 
 * Instructions:
 * 1. Install NodeJS on this computer.
 * 2. Open terminal in this folder and run: npm install ws
 * 3. Run the bridge: node hotek-bridge.js
 */

const net = require("net");
const WebSocket = require("ws");

// --- CONFIGURATION ---
const LOCAL_PORT = Number(process.env.HOTEK_LOCAL_PORT || 10003);
const PROPERTY_ID = Number(process.env.HOTEK_PROPERTY_ID || 1);
const BRIDGE_SECRET = process.env.HOTEK_BRIDGE_SECRET || process.env.SESSION_SECRET || "";
const CLOUD_API_URL = process.env.CLOUD_API_URL || process.env.VITE_API_URL || "http://localhost:4000";
const cloudUrl = new URL("/ws", CLOUD_API_URL);
cloudUrl.protocol = cloudUrl.protocol === "https:" ? "wss:" : "ws:";
cloudUrl.search = new URLSearchParams({
  propertyId: String(PROPERTY_ID),
  tunnel: "hotek",
}).toString();
const CLOUD_URL = cloudUrl.toString();
// ---------------------

console.log(`
=========================================
 🌉 SUNRISE HOUSING - HOTEK LOCAL BRIDGE 
=========================================
`);

let ws = null;
let tcpSocket = null;

function connectWs() {
  console.log(`[Cloud] Connecting to: ${CLOUD_URL}`);
  ws = new WebSocket(CLOUD_URL, ['hotek-tunnel'], {
    headers: {
      'X-Bridge-Type': 'hotek',
      'X-Bridge-Secret': BRIDGE_SECRET,
    }
  });
  
  ws.on('open', () => {
    console.log("[Cloud] ✅ Connected securely to the Cloud Backend.");
  });
  
  ws.on('message', (data) => {
    // Forward data from Cloud Backend to local Hotek PMSServer
    if (tcpSocket && !tcpSocket.destroyed) {
      tcpSocket.write(data);
    }
  });

  ws.on('close', (code, reason) => {
    console.log(`[Cloud] ❌ Connection closed (code: ${code}, reason: ${reason.toString()}). Reconnecting in 5 seconds...`);
    setTimeout(connectWs, 5000);
  });
  
  ws.on('error', (err) => {
    console.error("[Cloud] Error:", err.message);
  });
}

const server = net.createServer((socket) => {
  console.log(`[Local] ✅ Hotek PMSServer connected! (${socket.remoteAddress})`);
  
  if (tcpSocket && !tcpSocket.destroyed) {
    tcpSocket.destroy();
  }
  tcpSocket = socket;
  
  socket.on('data', (data) => {
    // Forward data from local Hotek PMSServer to Cloud Backend
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(data);
    } else {
      console.log("[Local] Warning: Received data from Hotek but Cloud API is not connected.");
    }
  });
  
  socket.on('close', () => {
    console.log("[Local] 🔌 Hotek PMSServer disconnected.");
    tcpSocket = null;
  });
  
  socket.on('error', (err) => {
    console.error("[Local] TCP Socket Error:", err.message);
  });
});

server.listen(LOCAL_PORT, "0.0.0.0", () => {
  console.log(`[Local] 🚀 Bridge listening for Hotek PMSServer on port ${LOCAL_PORT}`);
  connectWs();
});
