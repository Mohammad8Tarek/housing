import * as net from "net";

const STX = 0x02;
const ETX = 0x03;
const MAIN_PORT_KEY = -1;

interface PendingCmd {
  resolve: (val: HotekCmdResult) => void;
  reject: (err: Error) => void;
  timer: ReturnType<typeof setTimeout>;
  propertyId: number;
}

export interface HotekSocketLike {
  write(data: Buffer | Uint8Array | string): boolean;
  destroy(error?: Error): void;
  destroyed: boolean;
  remoteAddress?: string;
  remotePort?: number;
  on(event: string, listener: (...args: any[]) => void): void;
  setKeepAlive?(enable: boolean, initialDelay?: number): void;
  setNoDelay?(enable: boolean): void;
  setTimeout?(timeout: number): void;
}

export interface HotekCmdResult {
  success: boolean;
  cardNumber?: string;
  error?: string;
}

interface PortPms {
  port: number;
  server: net.Server | null;
  socket: HotekSocketLike | null;
  pendingCmd: PendingCmd | null;
  activePropertyIds: Set<number>;
}

// Map of PORT -> PortPms
const portServers = new Map<number, PortPms>();

// Map of Property ID -> configured PORT
const propertyPorts = new Map<number, number>();

let _app: any = null; // Express app reference for WebSocket broadcast

export function setPmsServerApp(app: any): void {
  _app = app;
}

// ─── Format Dates for FIAS ────────────────────────────────────────────────────
function formatFiasDate(d: Date): string {
  const yy = String(d.getFullYear()).slice(-2);
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yy}${mm}${dd}`; // YYMMDD
}

function formatFiasTime(d: Date): string {
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  const ss = String(d.getSeconds()).padStart(2, "0");
  return `${hh}${mm}${ss}`; // HHMMSS
}

// ─── FiAS Frame Builder ───────────────────────────────────────────────────────
function buildFiasFrame(payload: string): Buffer {
  return Buffer.from([STX, ...Buffer.from(payload, "ascii"), ETX]);
}

const buildFiASFrame = buildFiasFrame;

function buildFiasKrCommand(
  roomNumber: string,
  guestName: string,
  isDuplicate: boolean,
  workstationId: string,
  checkOutDate?: string | null,
  employeeJobNumber?: string | null,
): Buffer {
  const arrival = formatFiasDate(new Date());
  // If no checkOutDate provided, use far-future date (2099) so card works indefinitely
  const depDate = checkOutDate
    ? new Date(checkOutDate)
    : new Date("2099-12-31");
  const departure = formatFiasDate(depDate);
  const kt = isDuplicate ? "KTD" : "KTN";
  const kc = workstationId.replace("WS", "KC");
  const fullName = employeeJobNumber
    ? `${guestName} - ${employeeJobNumber}`
    : guestName;
  const payload = `KR|${workstationId}|${kc}|RN${roomNumber}|${kt}|G#1|GA${arrival}|GD${departure}|DT120000|GN${fullName}|`;
  return buildFiasFrame(payload);
}

// KO (Key Out) command — deletes the key for a room. FIAS spec § 4.6.
// Required fields per Hotek PMSServer: workstation | encoder | room | key-type | guest-id.
// We omit GD (departure date) and DT (valid-until) since the card is being invalidated.
function buildFiasKoCommand(
  roomNumber: string,
  workstationId: string,
  guestId: string = "1",
): Buffer {
  const kc = workstationId.replace("WS", "KC");
  const payload = `KO|${workstationId}|${kc}|RN${roomNumber}|KTS|G#${guestId}|`;
  return buildFiasFrame(payload);
}

// ─── Parse FIAS frames ────────────────────────────────────────────────────────
function handleHotekData(data: Buffer, port: number): Buffer {
  let start = data.indexOf(STX);
  let end = data.indexOf(ETX, start + 1);

  let lastEnd = 0;
  while (start !== -1 && end !== -1) {
    const payload = data.subarray(start + 1, end).toString("ascii");
    if (payload.includes("|")) {
      handleFiasPayload(payload, port);
    } else {
      // console.log(`[PMS-Bridge - Port ${port}] Ignored non-FIAS payload: ${payload}`);
    }
    lastEnd = end + 1;
    start = data.indexOf(STX, lastEnd);
    end = start !== -1 ? data.indexOf(ETX, start + 1) : -1;
  }
  return data.subarray(lastEnd);
}

function handleFiasPayload(payload: string, port: number) {
  const pms = portServers.get(port);
  if (!pms) return;

  // console.log(`[PMS-Bridge - Port ${port}] Received FIAS: ${payload}`);
  const parts = payload.split("|");
  const cmd = parts[0];

  if (cmd === "LS") {
    const la = `LA|DA${formatFiasDate(new Date())}|TI${formatFiasTime(new Date())}|`;
    // console.log(`[PMS-Bridge - Port ${port}] → Sending FIAS Link Alive: ${la}`);
    pms.socket?.write(buildFiasFrame(la));
  } else if (cmd === "KA") {
    let success = false;
    let cardUid = "";
    let statusMsg = "Unknown Error";

    for (const p of parts) {
      if (p.startsWith("AS")) {
        const status = p.substring(2);
        success = status === "OK";
        if (!success) statusMsg = status;
      }
      if (p.startsWith("CT")) statusMsg = p.substring(2);
      if (p.startsWith("$")) cardUid = p;
    }

    if (pms.pendingCmd) {
      const p = pms.pendingCmd;
      pms.pendingCmd = null;
      clearTimeout(p.timer);
      if (success) {
        p.resolve({ success: true, cardNumber: cardUid });
      } else {
        let errMsg = statusMsg;
        if (statusMsg === "OF")
          errMsg =
            "Encoder is OFFLINE or disconnected. Please check USB connection.";
        p.reject(new Error(errMsg));
      }
    }
  }
}

// ─── Public APIs ──────────────────────────────────────────────────────────────
export function issueCardViaHotek(
  propertyId: number,
  roomNumber: string,
  guestName: string,
  isDuplicate: boolean,
  workstationId: string = "WS1",
  timeoutMs: number = 30000,
  checkOutDate?: string | null,
  employeeJobNumber?: string | null,
): Promise<HotekCmdResult> {
  return new Promise((resolve, reject) => {
    const port = propertyPorts.get(propertyId);
    if (!port) {
      reject(new Error(`No PMS Server configured for property ${propertyId}.`));
      return;
    }

    const pms = portServers.get(port);
    if (!pms || !pms.socket || pms.socket.destroyed) {
      reject(new Error(`Hotek PMSServer on port ${port} is not connected.`));
      return;
    }
    if (pms.pendingCmd) {
      reject(
        new Error(
          "Another card operation is already in progress on this PMS Server.",
        ),
      );
      return;
    }

    const timer = setTimeout(() => {
      pms.pendingCmd = null;
      reject(
        new Error(
          `Timeout (${timeoutMs}ms): No response from Hotek. Please place the card on the encoder.`,
        ),
      );
    }, timeoutMs);

    pms.pendingCmd = { resolve, reject, timer, propertyId };

    const frame = buildFiasKrCommand(
      roomNumber,
      guestName,
      isDuplicate,
      workstationId,
      checkOutDate,
      employeeJobNumber,
    );
    // console.log(`[PMS-Bridge - Port ${port}] → Sending FIAS KR (Key Request) for room ${roomNumber} (Prop: ${propertyId})`);
    pms.socket.write(frame);
  });
}

export function checkoutViaHotek(
  propertyId: number,
  roomNumber: string,
  guestId: string = "1",
  workstationId: string = "WS1",
  timeoutMs: number = 15000,
): Promise<HotekCmdResult> {
  return new Promise((resolve, reject) => {
    const port = propertyPorts.get(propertyId);
    if (!port) {
      reject(new Error(`No PMS Server configured for property ${propertyId}.`));
      return;
    }

    const pms = portServers.get(port);
    if (!pms || !pms.socket || pms.socket.destroyed) {
      reject(new Error(`Hotek PMSServer on port ${port} is not connected.`));
      return;
    }
    if (pms.pendingCmd) {
      reject(
        new Error(
          "Another card operation is already in progress on this PMS Server.",
        ),
      );
      return;
    }

    const timer = setTimeout(() => {
      pms.pendingCmd = null;
      reject(
        new Error(
          `Timeout (${timeoutMs}ms): No response from Hotek. Please place the encoder on the card to delete it.`,
        ),
      );
    }, timeoutMs);

    pms.pendingCmd = { resolve, reject, timer, propertyId };

    const frame = buildFiasKoCommand(roomNumber, workstationId, guestId);
    // console.log(`[PMS-Bridge - Port ${port}] → Sending FIAS KO (Key Out / checkout) for room ${roomNumber} (Prop: ${propertyId})`);
    pms.socket.write(frame);
  });
}

export function getHotekStatus(propertyId: number): {
  connected: boolean;
  remoteAddress?: string;
} {
  const port = propertyPorts.get(propertyId);
  if (!port) return { connected: false };

  const pms = portServers.get(port);
  if (pms && pms.socket && !pms.socket.destroyed) {
    return {
      connected: true,
      remoteAddress: `${pms.socket.remoteAddress}:${pms.socket.remotePort} (Fidelio FIAS)`,
    };
  }
  return { connected: false };
}

// ─── TCP Server ───────────────────────────────────────────────────────────────

async function syncStatusToDb(
  port: number,
  connected: boolean,
  remoteAddress?: string,
): Promise<void> {
  const pms = portServers.get(port);
  if (!pms) return;

  try {
    const { pool } = await import("@workspace/db");
    for (const propertyId of pms.activePropertyIds) {
      if (connected) {
        await pool.query(
          `UPDATE public.property_hotek_servers
           SET last_seen_at = NOW(), last_success_at = NOW(), last_error = NULL, updated_at = NOW()
           WHERE property_id = $1 AND is_active = true`,
          [propertyId],
        );
      } else {
        await pool.query(
          `UPDATE public.property_hotek_servers
           SET last_seen_at = NOW(), last_error = 'PMS Bridge is online and waiting for Hotek PMSServer', updated_at = NOW()
           WHERE property_id = $1 AND is_active = true`,
          [propertyId],
        );
      }
      if (_app) {
        const io = _app.get("io");
        if (io) {
          io.emit("hotek:status", {
            propertyId,
            connected,
            remoteAddress: remoteAddress ?? null,
          });
        }
      }
    }
  } catch (err: any) {
    console.error(
      `[PMS-Bridge - Port ${port}] Failed to sync status to DB:`,
      err.message,
    );
  }
}

export function disconnectHotekClient(propertyId: number): void {
  const port = propertyPorts.get(propertyId);
  if (!port) return;

  const pms = portServers.get(port);
  if (pms && pms.socket) {
    pms.socket.destroy();
    pms.socket = null;
    // console.log(`[PMS-Bridge - Port ${port}] 🛑 Force disconnected Hotek client`);
    syncStatusToDb(port, false);
  }
}

function attachHotekSocketHandlers(
  port: number,
  socket: HotekSocketLike,
  addr: string,
): void {
  const currentPms = portServers.get(port);
  if (!currentPms) return;

  if (currentPms.socket && currentPms.socket !== socket && !currentPms.socket.destroyed) {
    currentPms.socket.destroy(new Error("Replaced by new Hotek connection"));
  }
  currentPms.socket = socket;

  syncStatusToDb(port, true, addr);

  if (typeof socket.setKeepAlive === "function") socket.setKeepAlive(true, 5000);
  if (typeof socket.setNoDelay === "function") socket.setNoDelay(true);
  if (typeof socket.setTimeout === "function") socket.setTimeout(300000);

  const pingInterval = setInterval(() => {
    if (currentPms && currentPms.socket && !currentPms.socket.destroyed) {
      const la = `LA|DA${formatFiasDate(new Date())}|TI${formatFiasTime(new Date())}|`;
      currentPms.socket.write(buildFiasFrame(la));
    }
  }, 20000);

  let buffer: Buffer = Buffer.alloc(0);
  const onData = (data: Buffer | Uint8Array | string) => {
    const chunk = Buffer.isBuffer(data)
      ? data
      : typeof data === "string"
        ? Buffer.from(data)
        : Buffer.from(data);
    buffer = Buffer.concat([buffer, chunk]);
    buffer = handleHotekData(buffer, port);
  };

  const onError = (err: Error | unknown) => {
    console.error(`[PMS-Bridge - Port ${port}] Hotek socket error:`, err instanceof Error ? err.message : String(err));
    if (currentPms.pendingCmd) {
      currentPms.pendingCmd.reject(
        new Error(`Hotek connection error: ${err instanceof Error ? err.message : String(err)}`),
      );
      currentPms.pendingCmd = null;
    }
  };

  const onClose = () => {
    clearInterval(pingInterval);
    if (currentPms.socket === socket) {
      currentPms.socket = null;
    }
    if (currentPms.pendingCmd) {
      currentPms.pendingCmd.reject(new Error("Hotek disconnected"));
      currentPms.pendingCmd = null;
    }
    syncStatusToDb(port, false);
  };

  socket.on("data", onData);
  socket.on("error", onError);
  socket.on("close", onClose);
}

export function registerHotekBridge(propertyId: number, socket: HotekSocketLike): void {
  const port = propertyPorts.get(propertyId) ?? MAIN_PORT_KEY;
  const pms = portServers.get(port);
  if (!pms) {
    propertyPorts.set(propertyId, port);
    portServers.set(port, {
      port,
      server: null,
      socket: null,
      pendingCmd: null,
      activePropertyIds: new Set([propertyId]),
    });
  }

  const targetPms = portServers.get(port);
  if (!targetPms) return;
  targetPms.activePropertyIds.add(propertyId);
  attachHotekSocketHandlers(port, socket, `hotek-bridge:${propertyId}`);
}

export function startPmsServerForProperty(
  propertyId: number,
  port: number,
): void {
  // Update property port mapping
  const oldPort = propertyPorts.get(propertyId);
  if (oldPort && oldPort !== port) {
    const oldPms = portServers.get(oldPort);
    if (oldPms) {
      oldPms.activePropertyIds.delete(propertyId);
      if (oldPms.activePropertyIds.size === 0) {
        // Stop the old server if no other properties are using it
        if (oldPms.socket) oldPms.socket.destroy();
        if (oldPms.server) oldPms.server.close();
        portServers.delete(oldPort);
        // console.log(`[PMS-Bridge - Port ${oldPort}] 🛑 Stopped PMS Server (No active properties)`);
      }
    }
  }

  propertyPorts.set(propertyId, port);

  // If server already running on this port, just add the property
  let pms = portServers.get(port);
  if (pms) {
    pms.activePropertyIds.add(propertyId);
    // console.log(`[PMS-Bridge - Port ${port}] ➕ Added Property ${propertyId} to existing server.`);
    if (pms.socket && !pms.socket.destroyed) {
      syncStatusToDb(
        port,
        true,
        `${pms.socket.remoteAddress}:${pms.socket.remotePort}`,
      );
    } else {
      syncStatusToDb(port, false);
    }
    return;
  }

  // Create new server for this port
  pms = {
    port,
    server: null,
    socket: null,
    pendingCmd: null,
    activePropertyIds: new Set([propertyId]),
  };
  portServers.set(port, pms);

  const server = net.createServer((socket) => {
    const addr = `${socket.remoteAddress}:${socket.remotePort}`;
    attachHotekSocketHandlers(port, socket as unknown as HotekSocketLike, addr);
  });

  pms.server = server;

  server.listen(port, "0.0.0.0", () => {
    // console.log(`[PMS-Bridge - Port ${port}] ✅ PMS Bridge Server listening (Shared by properties: ${Array.from(pms!.activePropertyIds).join(", ")})`);
  });

  server.on("error", (err: Error) =>
    console.error(`[PMS-Bridge - Port ${port}] Server error:`, err.message),
  );
}

export function stopPmsServerForProperty(propertyId: number): void {
  const port = propertyPorts.get(propertyId);
  if (!port) return;

  const pms = portServers.get(port);
  if (pms) {
    pms.activePropertyIds.delete(propertyId);
    propertyPorts.delete(propertyId);
    // console.log(`[PMS-Bridge - Port ${port}] ➖ Removed Property ${propertyId} from server.`);

    if (pms.activePropertyIds.size === 0) {
      if (pms.socket) {
        pms.socket.destroy();
        pms.socket = null;
      }
      if (pms.server) {
        pms.server.close();
        pms.server = null;
      }
      portServers.delete(port);
      // console.log(`[PMS-Bridge - Port ${port}] 🛑 Stopped PMS Server`);
    }
  }
}

// ─── Main port sharing (HTTP + FIAS on same port) ─────────────────────────

export function registerMainPortProperty(propertyId: number): void {
  if (!portServers.has(MAIN_PORT_KEY)) {
    portServers.set(MAIN_PORT_KEY, {
      port: MAIN_PORT_KEY,
      server: null,
      socket: null,
      pendingCmd: null,
      activePropertyIds: new Set(),
    });
  }
  const pms = portServers.get(MAIN_PORT_KEY)!;
  pms.activePropertyIds.add(propertyId);
  propertyPorts.set(propertyId, MAIN_PORT_KEY);
}

export function handleMainPortConnection(
  socket: net.Socket,
  data: Buffer,
): void {
  const addr = `${socket.remoteAddress}:${socket.remotePort}`;
  const pms = portServers.get(MAIN_PORT_KEY);
  if (!pms) {
    console.warn(`[PMS-Bridge - Main Port] No main port properties registered`);
    socket.destroy();
    return;
  }
  console.warn(
    `[PMS-Bridge - Main Port] Hotek PMSServer connected from ${addr}`,
  );

  if (pms.socket && !pms.socket.destroyed) {
    pms.socket.destroy();
  }
  pms.socket = socket;

  syncStatusToDb(MAIN_PORT_KEY, true, addr);

  socket.setKeepAlive(true, 5000);
  socket.setNoDelay(true);
  socket.setTimeout(300000);

  const pingInterval = setInterval(() => {
    if (pms && pms.socket && !pms.socket.destroyed) {
      const la = `LA|DA${formatFiasDate(new Date())}|TI${formatFiasTime(new Date())}|`;
      pms.socket.write(buildFiasFrame(la));
    }
  }, 20000);

  let buffer: Buffer = Buffer.alloc(0);
  buffer = Buffer.concat([buffer, data]);
  buffer = handleHotekData(buffer, MAIN_PORT_KEY);

  socket.on("data", (chunk: Buffer) => {
    buffer = Buffer.concat([buffer, chunk]);
    buffer = handleHotekData(buffer, MAIN_PORT_KEY);
  });

  socket.on("error", (err: Error) => {
    console.error(`[PMS-Bridge - Main Port] Hotek socket error:`, err.message);
    if (pms.pendingCmd) {
      pms.pendingCmd.reject(
        new Error(`Hotek connection error: ${err.message}`),
      );
      pms.pendingCmd = null;
    }
  });

  socket.on("close", () => {
    clearInterval(pingInterval);
    if (pms.socket === socket) {
      pms.socket = null;
    }
    if (pms.pendingCmd) {
      pms.pendingCmd.reject(new Error("Hotek disconnected"));
      pms.pendingCmd = null;
    }
    syncStatusToDb(MAIN_PORT_KEY, false);
  });
}

/** Stop all PMS servers (used during graceful shutdown) */
export function stopAllPmsServers(): void {
  for (const [port, pms] of portServers) {
    if (pms.socket) {
      pms.socket.destroy();
      pms.socket = null;
    }
    if (pms.server) {
      pms.server.close();
      pms.server = null;
    }
  }
  portServers.clear();
  propertyPorts.clear();
}

export async function startAllPmsServers(app?: any): Promise<void> {
  if (app) _app = app;

  const mainPort = Number(process.env.PORT) || 4000;
  console.warn(`[PMS-Bridge] Starting PMS servers (mainPort=${mainPort})`);

  try {
    const { pool } = await import("@workspace/db");
    const result = await pool.query(
      `SELECT property_id, port FROM public.property_hotek_servers WHERE is_active = true`,
    );
    console.warn(
      `[PMS-Bridge] Found ${result.rows.length} active Hotek servers:`,
      result.rows
        .map((r: any) => `(property=${r.property_id}, port=${r.port})`)
        .join(", "),
    );

    for (const row of result.rows) {
      if (row.port) {
        // Enforce port 10005 to match the user's Railway TCP Proxy settings
        const targetPmsPort = 10005;
        
        if (row.port !== targetPmsPort) {
          console.warn(
            `[PMS-Bridge] Property ${row.property_id} has drifted port ${row.port} — resetting back to ${targetPmsPort}`,
          );
          try {
            await pool.query(
              `UPDATE public.property_hotek_servers SET port = $1, updated_at = NOW() WHERE property_id = $2`,
              [targetPmsPort, row.property_id],
            );
            row.port = targetPmsPort;
          } catch (err: any) {
            console.error(
              `[PMS-Bridge] Failed to reset drifted port: ${err.message}`,
            );
          }
        }
        startPmsServerForProperty(row.property_id, row.port);
      }
    }
  } catch (err: any) {
    console.error("[PMS-Bridge] Failed to start all PMS servers:", err.message);
  }
}
