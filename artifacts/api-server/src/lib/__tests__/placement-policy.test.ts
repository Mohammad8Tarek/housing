import { describe, expect, it, vi } from "vitest";

vi.mock("@workspace/db", () => ({}));
vi.mock("@workspace/queue", () => ({ getRedisConnection: () => null }));

const { decidePolicy, exceptionColumns, isDuplicateActiveStay } =
  await import("../placement-policy");

const v = [{ code: "GENDER_ROOM_MISMATCH", messageAr: "ع", messageEn: "e" }];
const req = (permissions: string[], roles = ["receptionist"]) =>
  ({
    authUser: {
      id: 5,
      username: "sara",
      roles,
      permissions,
      isSystemAdmin: false,
    },
  }) as any;
const approver = req(["accommodation.approve_policy_exception"]);

describe("decidePolicy", () => {
  it("lets a compliant placement through with no exception", () => {
    const d = decidePolicy(
      req([]),
      { violations: [], requireApproval: true },
      {
        hasPolicyException: true,
        policyExceptionReason: "whatever",
      },
    );
    expect(d).toEqual({ ok: true, exception: null, warnings: [] });
  });
  it("refuses a violation without an exception", () => {
    const d: any = decidePolicy(
      req([]),
      { violations: v, requireApproval: true },
      {},
    );
    expect([d.ok, d.status, d.body.code]).toEqual([
      false,
      409,
      "POLICY_VIOLATION",
    ]);
  });
  it("needs the approve permission", () => {
    const d: any = decidePolicy(
      req(["accommodation.create"]),
      { violations: v, requireApproval: true },
      { hasPolicyException: true, policyExceptionReason: "Urgent need" },
    );
    expect([d.status, d.body.code]).toEqual([
      403,
      "POLICY_EXCEPTION_FORBIDDEN",
    ]);
  });
  it("needs a real reason", () => {
    const d: any = decidePolicy(
      approver,
      { violations: v, requireApproval: true },
      {
        hasPolicyException: true,
        policyExceptionReason: " ok ",
      },
    );
    expect(d.body.code).toBe("POLICY_EXCEPTION_REASON_REQUIRED");
  });
  it("records the signed-in user as approver, not the typed name", () => {
    const d: any = decidePolicy(
      approver,
      { violations: v, requireApproval: true },
      {
        hasPolicyException: true,
        policyExceptionReason: "Urgent need",
        policyApprovedBy: "General Manager",
      },
    );
    expect(d.exception).toEqual({
      reason: "Urgent need",
      approvedBy: "sara",
      codes: ["GENDER_ROOM_MISMATCH"],
    });
    expect(exceptionColumns(d.exception)).toMatchObject({
      hasPolicyException: true,
      policyApprovedBy: "sara",
    });
  });
  it("warning-only properties allow and report the violations", () => {
    const d = decidePolicy(
      req([]),
      { violations: v, requireApproval: false },
      {},
    );
    expect(d).toEqual({ ok: true, exception: null, warnings: v });
  });
});

describe("isDuplicateActiveStay", () => {
  it("recognises the one-stay-per-person index", () => {
    expect(
      isDuplicateActiveStay({
        code: "23505",
        constraint: "uq_assignments_one_active_per_profile",
      }),
    ).toBe(true);
    expect(isDuplicateActiveStay({ code: "23505", constraint: "other" })).toBe(
      false,
    );
    expect(isDuplicateActiveStay(new Error("x"))).toBe(false);
  });
});
