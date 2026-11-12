// Housing policy on the server. Every path that places or moves someone into
// a room runs the SAME rules the screens show (checkPolicyCompliance from
// @workspace/report-rows): level vs room capacity, entire-room entitlement,
// department / gender / family segregation, expired contract, smoking and
// "do not room together".
//
// When the property requires exception approval (the default), a violation is
// refused unless the request carries an exception: a reason, and a user who
// holds accommodation.approve_policy_exception. The approver recorded is the
// signed-in user, never a name typed in the browser.
import { and, eq, inArray, ne } from "drizzle-orm";
import type { Request } from "express";
import {
  assignmentsTable,
  profilesTable,
  roomsTable,
  settingsTable,
} from "@workspace/db";
import { checkPolicyCompliance } from "@workspace/report-rows";
import { hasPermission } from "../middlewares/permissions.js";

export type PolicyViolation = {
  code: string;
  messageAr: string;
  messageEn: string;
};

export interface PolicyEvaluation {
  violations: PolicyViolation[];
  /** Property setting: violations need a formal exception (default true). */
  requireApproval: boolean;
}

export interface PolicyException {
  reason: string;
  approvedBy: string;
  codes: string[];
}

export type PolicyDecision =
  | { ok: true; exception: PolicyException | null; warnings: PolicyViolation[] }
  | {
      ok: false;
      status: number;
      body: {
        error: string;
        errorEn: string;
        code: string;
        violations?: PolicyViolation[];
      };
    };

export const MIN_EXCEPTION_REASON = 5;

/**
 * Policy check for placing `profileId` in `roomId` (inside the caller's tenant
 * transaction). `excludeAssignmentIds` leaves out the person's own current
 * stay when they move rooms.
 */
export async function evaluatePlacementPolicy(
  tenantDb: any,
  opts: {
    profileId: number;
    roomId: number;
    isEntireRoom?: boolean;
    excludeAssignmentIds?: number[];
  },
): Promise<PolicyEvaluation> {
  const [settings] = await tenantDb.select().from(settingsTable).limit(1);
  const [profile] = await tenantDb
    .select()
    .from(profilesTable)
    .where(eq(profilesTable.id, opts.profileId))
    .limit(1);
  const [room] = await tenantDb
    .select()
    .from(roomsTable)
    .where(eq(roomsTable.id, opts.roomId))
    .limit(1);
  const requireApproval = settings?.policyRequireExceptionApproval !== false;
  if (!profile || !room) return { violations: [], requireApproval };

  const exclude = (opts.excludeAssignmentIds ?? []).filter(Boolean);
  const conds = [
    eq(assignmentsTable.roomId, opts.roomId),
    eq(assignmentsTable.status, "ACTIVE"),
    ne(assignmentsTable.profileId, opts.profileId),
  ];
  for (const id of exclude) conds.push(ne(assignmentsTable.id, id));
  const roomAssignments = await tenantDb
    .select()
    .from(assignmentsTable)
    .where(and(...conds));
  const roommateIds = [
    ...new Set<number>(roomAssignments.map((a: any) => Number(a.profileId))),
  ];
  const roommates = roommateIds.length
    ? await tenantDb
        .select()
        .from(profilesTable)
        .where(inArray(profilesTable.id, roommateIds))
    : [];

  const { violations } = checkPolicyCompliance({
    profile,
    room,
    assignments: roomAssignments,
    profiles: roommates,
    policySettings: settings ?? {},
    isEntireRoom: Boolean(opts.isEntireRoom),
  });
  return { violations, requireApproval };
}

/** Exception fields a request may carry. */
export function exceptionRequest(body: any): {
  requested: boolean;
  reason: string;
} {
  return {
    requested: Boolean(body?.hasPolicyException),
    reason:
      typeof body?.policyExceptionReason === "string"
        ? body.policyExceptionReason.trim().slice(0, 1000)
        : "",
  };
}

/** Decide whether a placement may go ahead, given the request's exception. */
export function decidePolicy(
  req: Request,
  evaluation: PolicyEvaluation,
  body: any,
): PolicyDecision {
  const { violations, requireApproval } = evaluation;
  if (violations.length === 0) {
    return { ok: true, exception: null, warnings: [] };
  }
  if (!requireApproval) {
    // Property chose warnings only: allowed, logged by the caller.
    return { ok: true, exception: null, warnings: violations };
  }
  const ask = exceptionRequest(body);
  if (!ask.requested) {
    return {
      ok: false,
      status: 409,
      body: {
        error:
          "التسكين يخالف سياسة السكن ويحتاج استثناء معتمد: " +
          violations.map((v) => v.messageAr).join(" | "),
        errorEn:
          "This placement breaks the housing policy and needs an approved exception: " +
          violations.map((v) => v.messageEn).join(" | "),
        code: "POLICY_VIOLATION",
        violations,
      },
    };
  }
  const actor = (req as any).authUser;
  if (
    !actor ||
    !hasPermission(actor, "accommodation", "approve_policy_exception")
  ) {
    return {
      ok: false,
      status: 403,
      body: {
        error:
          "اعتماد استثناء سياسة السكن يحتاج صلاحية (اعتماد استثناءات سياسة السكن).",
        errorEn:
          "Approving a housing-policy exception requires the accommodation.approve_policy_exception permission.",
        code: "POLICY_EXCEPTION_FORBIDDEN",
        violations,
      },
    };
  }
  if (ask.reason.length < MIN_EXCEPTION_REASON) {
    return {
      ok: false,
      status: 400,
      body: {
        error: "اكتب سبب الاستثناء (5 أحرف على الأقل).",
        errorEn: "Enter the reason for the exception (at least 5 characters).",
        code: "POLICY_EXCEPTION_REASON_REQUIRED",
        violations,
      },
    };
  }
  return {
    ok: true,
    exception: {
      reason: ask.reason,
      approvedBy: String(actor.username ?? `user #${actor.id}`),
      codes: violations.map((v) => v.code),
    },
    warnings: [],
  };
}

/** Columns + note prefix to store with the assignment. */
export function exceptionColumns(exception: PolicyException | null): {
  hasPolicyException: boolean;
  policyExceptionReason: string | null;
  policyApprovedBy: string | null;
  notePrefix: string;
} {
  if (!exception) {
    return {
      hasPolicyException: false,
      policyExceptionReason: null,
      policyApprovedBy: null,
      notePrefix: "",
    };
  }
  return {
    hasPolicyException: true,
    policyExceptionReason: exception.reason,
    policyApprovedBy: exception.approvedBy,
    notePrefix: `[استثناء سياسة السكن (${exception.codes.join(", ")}) معتمد من: ${exception.approvedBy}] (المبرر: ${exception.reason})`,
  };
}

/** True when `err` is the database refusing a second ACTIVE stay for one person. */
export function isDuplicateActiveStay(err: unknown): boolean {
  const e: any = err;
  const code = e?.code ?? e?.cause?.code;
  const constraint = e?.constraint ?? e?.cause?.constraint ?? "";
  return (
    code === "23505" &&
    String(constraint).includes("uq_assignments_one_active_per_profile")
  );
}

export const DUPLICATE_STAY_ERROR = {
  error:
    "الموظف مسكّن بالفعل في غرفة أخرى (تم تسكينه للتو من طلب آخر). لا يمكن تسكين نفس الشخص مرتين.",
  errorEn:
    "This employee was just housed by another request. One person cannot have two active stays.",
  code: "PROFILE_ALREADY_ASSIGNED",
};
