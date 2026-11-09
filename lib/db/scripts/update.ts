// Force the PMSServer to reconnect by closing the existing ESTABLISHED connection
// This will make PMSServer automatically reconnect, which will trigger our onConnect handler
import * as net from "net";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

// Find the PMSServer connection port
const { stdout } = await execAsync('netstat -ano | findstr ":10003"');
console.log("Current connections:\n", stdout);

// The PMSServer process (15812) is connected from port 38006 to 10003
// We need to find which port PMSServer is using and close that specific socket
// The easiest way: kill the PMSServer side's connection so it reconnects

// Actually, since our TCP server (node) has the socket,
// Let's connect as a NEW client to simulate a Hotek device reconnecting
// This will trigger the onConnect handler in pms-server.ts

console.log("\n--- Simulating Hotek Link-Alive (LS) message ---");
const socket = new net.Socket();

socket.connect(10003, "127.0.0.1", () => {
  console.log("✅ Connected to PMS Bridge on port 10003");

  // Send a FIAS LS (Link Status) frame to trigger the bridge to register us
  // FIAS frame: STX + payload + ETX
  const STX = 0x02;
  const ETX = 0x03;
  const payload = "LS|DA260706|TI154200|";
  const frame = Buffer.from([STX, ...Buffer.from(payload, "ascii"), ETX]);

  console.log("Sending FIAS LS frame:", payload);
  socket.write(frame);

  // Wait for response
  socket.once("data", (data) => {
    const response = data.slice(1, data.indexOf(ETX)).toString("ascii");
    console.log("✅ Response from PMS Bridge:", response);
    socket.destroy();
    console.log("\n✅ PMS Bridge is responding correctly!");
    console.log(
      "The real Hotek PMSServer needs to reconnect to trigger status update.",
    );
    process.exit(0);
  });

  setTimeout(() => {
    console.log("No response in 3s");
    socket.destroy();
    process.exit(0);
  }, 3000);
});

socket.on("error", (err) => {
  console.log("❌ Error:", err.message);
  process.exit(1);
});
