// Vendor-agnostic gate access evaluation + a ZKTeco ATTLOG adapter.
//
// Any access-control device (ZKTeco, Hikvision, Suprema, a custom turnstile
// bridge) ultimately produces a normalized GateEvent; the server decides
// GRANT/DENY from the resident's housing state and logs IN/OUT. Keeping the
// pieces pure makes the decision and the ZKTeco parsing unit-testable without a
// device or a database.

export type GateDirection = "IN" | "OUT";
export type GateMethod =
  | "FINGERPRINT"
  | "FACE"
  | "CARD"
  | "PASSWORD"
  | "PALM"
  | "QR_SCAN"
  | "OTHER";

export interface NormalizedGateEvent {
  /** How the device knows the resident (PIN / employee id / card number). */
  userRef: string;
  direction: GateDirection;
  method: GateMethod;
  /** ISO timestamp of the punch, if the device provided one. */
  at?: string;
}

/** Normalize a free-form direction value to IN/OUT (defaulting to IN). */
export function normalizeDirection(
  value: unknown,
  fallback: GateDirection = "IN",
): GateDirection {
  const s = String(value ?? "")
    .trim()
    .toUpperCase();
  if (s === "OUT" || s === "O" || s === "EXIT" || s === "1") return "OUT";
  if (s === "IN" || s === "I" || s === "ENTRY" || s === "0") return "IN";
  return fallback;
}

// ZKTeco ATTLOG "verify mode" codes → our method vocabulary. Codes vary a little
// by firmware; the common set is covered and anything else falls back to OTHER.
const ZK_VERIFY_METHOD: Record<string, GateMethod> = {
  "0": "PASSWORD",
  "1": "FINGERPRINT",
  "2": "FINGERPRINT", // some firmwares: FP (another template slot)
  "3": "CARD",
  "4": "CARD",
  "9": "PALM",
  "15": "FACE",
};

/**
 * Parse one ZKTeco ADMS "ATTLOG" record. Format is tab-separated:
 *   PIN \t YYYY-MM-DD HH:mm:ss \t status \t verify \t workcode \t ...
 * `status` is the punch state (0 = check-in, 1 = check-out by default);
 * `verify` is the verification mode. Returns null for an unparseable line.
 */
export function parseZktecoAttlogLine(
  line: string,
  opts: { outStatuses?: number[]; defaultDirection?: GateDirection } = {},
): NormalizedGateEvent | null {
  if (!line || typeof line !== "string") return null;
  const cols = line.split("\t").map((c) => c.trim());
  const userRef = cols[0];
  if (!userRef) return null;

  const rawTime = cols[1] || "";
  const status = cols[2];
  const verify = cols[3];

  // Odd punch states are exits by default (1 = check-out, 3 = break-in-return,
  // 5 = overtime-out); callers may override with an explicit list.
  const outStatuses = opts.outStatuses;
  const statusNum = Number(status);
  let direction: GateDirection;
  if (Array.isArray(outStatuses)) {
    direction = outStatuses.includes(statusNum) ? "OUT" : "IN";
  } else if (Number.isFinite(statusNum)) {
    direction = statusNum % 2 === 1 ? "OUT" : "IN";
  } else {
    direction = opts.defaultDirection ?? "IN";
  }

  const method = ZK_VERIFY_METHOD[String(verify)] ?? "OTHER";

  let at: string | undefined;
  if (rawTime) {
    // ZKTeco emits local time "YYYY-MM-DD HH:mm:ss"; keep it as-is if it does
    // not parse cleanly rather than inventing a timezone.
    const parsed = new Date(rawTime.replace(" ", "T"));
    at = Number.isNaN(parsed.getTime()) ? undefined : parsed.toISOString();
  }

  return { userRef, direction, method, at };
}

/** Parse a full ATTLOG upload body (one record per line). */
export function parseZktecoAttlog(
  body: string,
  opts: { outStatuses?: number[]; defaultDirection?: GateDirection } = {},
): NormalizedGateEvent[] {
  if (!body) return [];
  return body
    .split(/\r?\n/)
    .map((l) => parseZktecoAttlogLine(l, opts))
    .filter((e): e is NormalizedGateEvent => e !== null);
}

export interface GateDecision {
  decision: "GRANT" | "DENY";
  status: "GRANTED" | "DENIED";
  reason: string | null;
}

/**
 * Decide gate access from a resident's resolved housing state. GRANT only for a
 * profile that exists and currently has an active accommodation; everything
 * else is denied with a bilingual reason.
 */
export function decideGateAccess(args: {
  profile: { status?: string | null } | null | undefined;
  hasActiveAssignment: boolean;
}): GateDecision {
  const { profile, hasActiveAssignment } = args;
  if (!profile) {
    return {
      decision: "DENY",
      status: "DENIED",
      reason: "المقيم غير معروف / Resident not found",
    };
  }
  if (!hasActiveAssignment) {
    return {
      decision: "DENY",
      status: "DENIED",
      reason: "لا يوجد تسكين فعّال / No active accommodation",
    };
  }
  return { decision: "GRANT", status: "GRANTED", reason: null };
}
