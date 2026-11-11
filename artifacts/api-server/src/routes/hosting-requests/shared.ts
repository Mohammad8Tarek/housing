// Helpers shared by the hosting-requests route modules.
import { pool } from "@workspace/db";
import { logger } from "../../lib/logger.js";
import { z } from "zod/v4";

export const APPROVAL_ROLES = [
  "housing_manager",
  "hr_manager",
  "accounts_manager",
] as const;

export const STEP_ROLES: Record<number, string> = {
  1: "housing_manager",
  2: "hr_manager",
  3: "accounts_manager",
};

export interface SignatureStepPolicyItem {
  stepOrder: number;
  roleRequired: string;
  labelAr: string;
  labelEn: string;
  isMandatory?: boolean;
}

export const DEFAULT_SIGNATURE_POLICY: SignatureStepPolicyItem[] = [
  {
    stepOrder: 1,
    roleRequired: "housing_manager",
    labelAr: "مدير السكن",
    labelEn: "Housing Manager",
    isMandatory: true,
  },
  {
    stepOrder: 2,
    roleRequired: "hr_manager",
    labelAr: "مدير الموارد البشرية",
    labelEn: "Human Resources Manager",
    isMandatory: true,
  },
  {
    stepOrder: 3,
    roleRequired: "accounts_manager",
    labelAr: "المدير المالي / الحسابات",
    labelEn: "Accounts / Finance Manager",
    isMandatory: true,
  },
];

export async function getPropertySignaturePolicy(
  propertyId?: number | null,
): Promise<SignatureStepPolicyItem[]> {
  if (!propertyId) return DEFAULT_SIGNATURE_POLICY;
  try {
    const propRes = await pool.query(
      "SELECT schema_name FROM public.properties WHERE id = $1 LIMIT 1",
      [propertyId],
    );
    const schema = propRes.rows[0]?.schema_name;
    if (schema && /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(schema)) {
      const sRes = await pool.query(
        `SELECT hosting_request_signature_policy FROM "${schema}".settings LIMIT 1`,
      );
      const policy = sRes.rows[0]?.hosting_request_signature_policy;
      if (Array.isArray(policy) && policy.length > 0) {
        return policy;
      }
    }
  } catch (err: any) {
    logger.warn(
      { err: err.message, propertyId },
      "Could not fetch property signature policy, falling back to default",
    );
  }
  return DEFAULT_SIGNATURE_POLICY;
}

export const CreateFamilyVisitBody = z.object({
  hotelId: z.number().optional(),
  visitHotelId: z.number().optional(),
  clockNumber: z.string().optional(),
  numberOfRooms: z.number().int().min(1),
  assignedRoomId: z.number().int().optional(),
  familyMembersCount: z.number().int().min(1),
  familyMembersIncluded: z.string().optional(),
  fromDate: z.string().min(1),
  toDate: z.string().min(1),
  consumedDays: z.number().int().min(1),
  remarks: z.string().optional(),
  attachmentData: z.string().optional(),
});

export const ListQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(5000).default(25),
  status: z.string().optional(),
  hotelId: z.coerce.number().optional(),
  search: z.string().optional(),
  fromDate: z.string().optional(),
  toDate: z.string().optional(),
});

export const SignBody = z.object({
  comment: z.string().optional(),
});

export const RejectBody = z.object({
  reason: z.string().min(1, "Rejection reason is required"),
});

export const RebackBody = z.object({
  reason: z.string().min(1, "Reback reason is required"),
});

export function su(req: any) {
  const s = req.session ?? {};
  const a = req.authUser as any;
  return {
    userId: s.userId,
    propertyId: s.propertyId,
    propertyIds: a?.propertyIds ?? (s.propertyId ? [s.propertyId] : []),
    username: s.username,
    userRole: Array.isArray(s.userRole) ? s.userRole[0] : s.userRole || "",
    roles: s.userRole
      ? Array.isArray(s.userRole)
        ? s.userRole
        : [s.userRole]
      : [],
    jobTitle: s.jobTitle || "",
    isSystemAdmin: !!s.isSystemAdmin,
  };
}

export async function ensureProfileInTargetSchema(
  client: any,
  sourcePropertyId: number,
  targetPropertyId: number,
  clockNumber: string,
) {
  if (!clockNumber) return null;

  const propRes = await client.query(
    "SELECT id, schema_name FROM public.properties WHERE id IN ($1, $2)",
    [sourcePropertyId, targetPropertyId],
  );
  let sourceSchema = `prop_${sourcePropertyId}`;
  let targetSchema = `prop_${targetPropertyId}`;
  for (const p of propRes.rows) {
    if (p.id === sourcePropertyId && p.schema_name)
      sourceSchema = p.schema_name;
    if (p.id === targetPropertyId && p.schema_name)
      targetSchema = p.schema_name;
  }

  if (
    !/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(sourceSchema) ||
    !/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(targetSchema)
  ) {
    return null;
  }

  // 1. Check target
  const targetCheck = await client.query(
    `SELECT id FROM "${targetSchema}".profiles WHERE profile_id = $1 LIMIT 1`,
    [clockNumber],
  );
  if (targetCheck.rows.length > 0)
    return { profileId: targetCheck.rows[0].id, targetSchema };

  // 2. Try source if different
  if (sourceSchema !== targetSchema) {
    const sourceCheck = await client.query(
      `SELECT * FROM "${sourceSchema}".profiles WHERE profile_id = $1 LIMIT 1`,
      [clockNumber],
    );
    if (sourceCheck.rows.length > 0) {
      const emp = sourceCheck.rows[0];
      const insertRes = await client.query(
        `
        INSERT INTO "${targetSchema}".profiles 
        (profile_id, first_name, last_name, national_id, nationality, address, job_title, level, phone, department, status, hire_date, gender, id_image, photo_url, email)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
        RETURNING id
      `,
        [
          emp.profile_id,
          emp.first_name,
          emp.last_name,
          emp.national_id,
          emp.nationality,
          emp.address,
          emp.job_title,
          emp.level,
          emp.phone,
          emp.department,
          emp.status,
          emp.hire_date,
          emp.gender,
          emp.id_image,
          emp.photo_url,
          emp.email,
        ],
      );
      return { profileId: insertRes.rows[0].id, targetSchema };
    }
  }

  return null;
}

export async function resolveRequestId(
  paramId: string,
): Promise<number | null> {
  let requestId = parseInt(paramId);
  if (isNaN(requestId)) {
    const lookupRes = await pool.query(
      "SELECT id FROM public.hosting_requests WHERE request_number = $1 LIMIT 1",
      [paramId],
    );
    if (lookupRes.rows.length === 0) return null;
    return lookupRes.rows[0].id;
  }
  return requestId;
}

export function approvalRoleKey(value: unknown): string {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

export function canAccessProperty(
  requestPropertyId: number,
  userPropertyIds: number[],
  isSystemAdmin: boolean,
): boolean {
  if (isSystemAdmin) return true;
  return userPropertyIds.includes(requestPropertyId);
}

export function userMatchesApprovalRole(
  user: ReturnType<typeof su>,
  requiredRole: string,
): boolean {
  const required = approvalRoleKey(requiredRole);
  if (!required) return false;

  // Check by job title first (normalized comparison)
  if (approvalRoleKey(user.jobTitle) === required) return true;

  // Also check by user roles array
  for (const role of user.roles) {
    if (approvalRoleKey(role) === required) return true;
  }

  return false;
}

export async function hasAlreadyActedOnRequest(
  client: any,
  requestId: number,
  userId: number,
): Promise<boolean> {
  const existingAction = await client.query(
    `SELECT id
     FROM public.hosting_request_approval_steps
     WHERE request_id = $1
       AND signed_by_user_id = $2
       AND status IN ('signed', 'rejected', 'returned')
     LIMIT 1`,
    [requestId, userId],
  );
  return existingAction.rows.length > 0;
}

export async function generateRequestNumber(
  client: any,
  propertyId: number,
): Promise<string> {
  const year = new Date().getFullYear();
  let code = "FV";

  if (propertyId) {
    const propRes = await client.query(
      "SELECT code FROM public.properties WHERE id = $1",
      [propertyId],
    );
    if (propRes.rows.length > 0 && propRes.rows[0].code) {
      code = propRes.rows[0].code.toUpperCase();
    }
  }

  const prefix = `${code}-${year}-`;

  // Use advisory lock keyed by property+year to prevent race condition
  // NOTE: Uses the transaction client so the lock is held until COMMIT
  const lockKey = propertyId * 10000 + year || year;
  await client.query("SELECT pg_advisory_xact_lock($1)", [lockKey]);

  const res = await client.query(
    "SELECT COUNT(*)::int AS cnt FROM public.hosting_requests WHERE request_number LIKE $1",
    [`${prefix}%`],
  );
  const seq = (res.rows[0]?.cnt ?? 0) + 1;
  return `${prefix}${String(seq).padStart(4, "0")}`;
}

export async function getRequestWithSteps(
  requestId: number,
  propertyIds: number[],
  isSystemAdmin: boolean,
) {
  const requestRes = await pool.query(
    `SELECT fvr.*, p.display_name AS property_name, h1.display_name AS hotel_name, h2.display_name AS visit_hotel_name,
      json_agg(
        json_build_object(
          'id', fas.id,
          'stepOrder', fas.step_order,
          'roleRequired', fas.role_required,
          'status', fas.status,
          'labelAr', fas.label_ar,
          'labelEn', fas.label_en,
          'signedByUserId', fas.signed_by_user_id,
          'signedAt', fas.signed_at,
          'signatureImageUrlSnapshot', fas.signature_image_url_snapshot,
          'comment', fas.comment,
          'signerName', su.username,
          'signerJobTitle', su.job_title
        ) ORDER BY fas.step_order
      ) FILTER (WHERE fas.id IS NOT NULL) AS approval_steps
    FROM public.hosting_requests fvr
    LEFT JOIN public.properties p ON p.id = fvr.property_id
    LEFT JOIN public.properties h1 ON h1.id = fvr.hotel_id
    LEFT JOIN public.properties h2 ON h2.id = fvr.visit_hotel_id
    LEFT JOIN public.hosting_request_approval_steps fas ON fas.request_id = fvr.id
    LEFT JOIN public.users su ON su.id = fas.signed_by_user_id
    WHERE fvr.id = $1
    GROUP BY fvr.id, p.display_name, h1.display_name, h2.display_name`,
    [requestId],
  );
  if (requestRes.rows.length === 0) return null;
  const row = requestRes.rows[0];
  if (!isSystemAdmin && !propertyIds.includes(row.property_id)) return null;

  const request = {
    id: row.id,
    propertyId: row.property_id,
    requestNumber: row.request_number,
    hotelId: row.hotel_id,
    hotelName: row.hotel_name,
    visitHotelId: row.visit_hotel_id,
    visitHotelName: row.visit_hotel_name,
    profileName: row.profile_name,
    clockNumber: row.clock_number,
    department: row.department,
    position: row.position,
    numberOfRooms: row.number_of_rooms,
    assignedRoomId: row.assigned_room_id,
    assignedRoomNumber: row.assigned_room_number || null,
    familyMembersCount: row.family_members_count,
    familyMembersIncluded: row.family_members_included,
    fromDate: row.from_date,
    toDate: row.to_date,
    consumedDays: row.consumed_days,
    remarks: row.remarks,
    status: row.status,
    currentStepOrder: row.current_step_order,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    propertyName: row.property_name,
    approvalSteps: row.approval_steps || [],
    guestHostingId: row.guest_hosting_id,
    attachmentData: row.attachment_data,
  };

  if (request.assignedRoomId) {
    try {
      const propRes = await pool.query(
        "SELECT schema_name FROM public.properties WHERE id = $1",
        [row.property_id],
      );
      const schemaName =
        propRes.rows[0]?.schema_name || `prop_${row.property_id}`;
      const roomRes = await pool.query(
        `SELECT room_number FROM "${schemaName}".rooms WHERE id = $1`,
        [request.assignedRoomId],
      );
      if (roomRes.rows.length > 0) {
        request.assignedRoomNumber = roomRes.rows[0].room_number;
      }
    } catch (e) {
      console.error("Error fetching room number for family visit:", e);
    }
  }

  return request;
}
