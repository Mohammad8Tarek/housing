import { execFile } from "child_process";
import { promisify } from "util";
import os from "os";

const execFileAsync = promisify(execFile);

export async function isIpReachable(ip: string): Promise<boolean> {
  if (!ip) return false;

  // Allow only valid hostnames/IPs (no shell metacharacters)
  const ipRegex = /^[a-zA-Z0-9.-]+$/;
  if (!ipRegex.test(ip)) return false;

  const isWindows = os.platform() === "win32";
  const args = isWindows
    ? ["-n", "1", "-w", "1000", ip]
    : ["-c", "1", "-W", "1", ip];
  const bin = isWindows ? "ping" : "ping";

  try {
    const { stdout } = await execFileAsync(bin, args);
    if (isWindows && stdout.toLowerCase().includes("unreachable")) {
      return false;
    }
    if (isWindows && stdout.toLowerCase().includes("timed out")) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}
