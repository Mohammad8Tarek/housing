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
const LOCAL_PORT = 10003;
const PROPERTY_ID = 1; // Change this if your property ID in the database is different
const BRIDGE_SECRET = process.env.HOTEK_BRIDGE_SECRET || process.env.SESSION_SECRET || "";
const CLOUD_URL = `wss://sunrise-api-production-b3f9.up.railway.app/ws?propertyId=${PROPERTY_ID}&tunnel=hotek`;
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
