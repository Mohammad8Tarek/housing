import { describe, it, expect } from "vitest";
import { z, ZodError } from "zod";
import { validate } from "../../middlewares/validate.js";
import {
  UpdateSettingsBody,
  GateLogBody,
  BroadcastSendBody,
  CustomReportQueryBody,
  GateLogsQuery,
  RoomImportExecuteBody,
} from "../schemas.js";
import { IdParams, zDateString } from "../common.js";
import { safeSchemaName } from "../../lib/pg-ident.js";

function run(mw: ReturnType<typeof validate>, req: any) {
  let error: unknown = null;
  mw(req, {} as any, (e?: unknown) => { error = e ?? null; });
  return error;
}

describe("validate middleware", () => {
  it("replaces body with parsed values and strips unknown keys", () => {
    const req: any = { body: { smtpPort: "587", evil: "x", systemName: "  Sunrise  " } };
    const err = run(validate({ body: UpdateSettingsBody }), req);
    expect(err).toBeNull();
    expect(req.body).toEqual({ smtpPort: 587, systemName: "Sunrise" });
  });

  it("forwards a ZodError for invalid body", () => {
    const req: any = { body: { smtpPort: "99999" } };
    const err = run(validate({ body: UpdateSettingsBody }), req);
    expect(err).toBeInstanceOf(ZodError);
  });

  it("coerces params and query (Express 5 getter-safe)", () => {
    const req: any = { params: { id: "42" } };
    Object.defineProperty(Object.getPrototypeOf(req), "query", { get: () => ({ page: "3", limit: "25", direction: "all" }), configurable: true });
    const err = run(validate({ params: IdParams, query: GateLogsQuery }), req);
    expect(err).toBeNull();
    expect(req.params.id).toBe(42);
    expect(req.query).toEqual({ page: 3, limit: 25, direction: "all" });
    delete (Object.getPrototypeOf(req) as any).query;
  });

  it("rejects non-numeric ids", () => {
    const err = run(validate({ params: IdParams }), { params: { id: "1 OR 1=1" } });
    expect(err).toBeInstanceOf(ZodError);
  });
});

describe("schemas", () => {
  it("GateLogBody applies defaults and enums", () => {
    const parsed = GateLogBody.parse({ employeeId: 10575, fullName: "Test" });
    expect(parsed.direction).toBe("IN");
    expect(parsed.status).toBe("GRANTED");
    expect(() => GateLogBody.parse({ employeeId: "1", fullName: "x", direction: "SIDEWAYS" })).toThrow();
  });

  it("BroadcastSendBody allows recipients without phone (filtered later)", () => {
    const parsed = BroadcastSendBody.parse({ messageText: "hi", recipients: [{ profileId: "5", phone: "" }] });
    expect(parsed.recipients[0].profileId).toBe(5);
    expect(() => BroadcastSendBody.parse({ messageText: "", recipients: [] })).toThrow();
  });

  it("CustomReportQueryBody caps limit and restricts sortBy to identifiers", () => {
    expect(() => CustomReportQueryBody.parse({ limit: 999999 })).toThrow();
    expect(() => CustomReportQueryBody.parse({ sortBy: "name; DROP TABLE x" })).toThrow();
    expect(CustomReportQueryBody.parse({}).dataSource).toBe("in_house");
  });

  it("RoomImportExecuteBody requires rooms and a known import mode", () => {
    expect(() => RoomImportExecuteBody.parse({ rooms: [] })).toThrow();
    expect(() => RoomImportExecuteBody.parse({ rooms: [{}], importMode: "nuke" })).toThrow();
    expect(RoomImportExecuteBody.parse({ rooms: [{ roomNumber: "101" }] }).importMode).toBe("create_update");
  });

  it("zDateString accepts ISO and DD/MM/YYYY", () => {
    expect(zDateString.parse("2026-11-08")).toBe("2026-11-08");
    expect(zDateString.parse("08/11/2026")).toBe("08/11/2026");
    expect(() => zDateString.parse("not a date")).toThrow();
  });
});

describe("safeSchemaName", () => {
  it("accepts valid identifiers and defaults to public", () => {
    expect(safeSchemaName("taal_housing")).toBe("taal_housing");
    expect(safeSchemaName("")).toBe("public");
    expect(safeSchemaName(undefined)).toBe("public");
  });
  it("rejects injection attempts", () => {
    expect(() => safeSchemaName('public"; DROP SCHEMA x; --')).toThrow();
    expect(() => safeSchemaName("a.b")).toThrow();
  });
});
