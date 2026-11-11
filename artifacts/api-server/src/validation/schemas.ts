/**
 * Request schemas for routes that previously consumed req.body / req.query / req.params
 * without validation. Grouped by route file. Apply with `validate({ body, query, params })`.
 */
import { z } from "zod";
import {
  zId,
  zOptionalId,
  zText,
  zNullableText,
  zBool,
  zDateString,
  zOptionalDateString,
  paginationQuery,
} from "./common.js";

// ─── settings.ts ─────────────────────────────────────────────────────────────
const optText = (max = 1000) => zText(max).nullable().optional();
const optInt = (min = 0, max = 100000) =>
  z.preprocess((v) => (v === "" || v === null ? undefined : v), z.coerce.number().int().min(min).max(max).optional());
const optBool = zBool.optional();
const optJson = z.union([z.record(z.any()), z.array(z.any())]).optional();

export const UpdateSettingsBody = z
  .object({
    systemName: optText(200),
    systemLogo: optText(2_000_000),
    defaultLanguage: z.enum(["ar", "en"]).optional(),
    primaryColor: optText(32),
    sidebarColor: optText(32),
    buttonColor: optText(32),
    departureAlertsEnabled: optBool,
    departureAlertThreshold: optInt(0, 365),
    reportFooter: optText(2000),
    portalContactEmail: optText(200),
    portalContactPhone: optText(50),
    portalContactExt: optText(20),
    passwordMinLength: optInt(4, 128),
    passwordRequireUppercase: optBool,
    passwordRequireLowercase: optBool,
    passwordRequireNumber: optBool,
    passwordRequireSymbol: optBool,
    passwordExpiryDays: optInt(0, 3650),
    passwordHistoryCount: optInt(0, 50),
    lockoutThreshold: optInt(0, 100),
    lockoutDurationMinutes: optInt(0, 100000),
    smtpHost: optText(255),
    smtpPort: optInt(1, 65535),
    smtpSecure: optBool,
    smtpUser: optText(255),
    smtpPass: optText(500),
    smtpFrom: optText(255),
    policyLevel0Capacity: optInt(0, 50),
    policyLevel1Capacity: optInt(0, 50),
    policyLevel2Capacity: optInt(0, 50),
    policyLevel3Capacity: optInt(0, 50),
    policyLevel4Capacity: optInt(0, 50),
    policyLevel5Capacity: optInt(0, 50),
    policyLevel6Capacity: optInt(0, 50),
    policyLevel0AllowEntire: optBool,
    policyLevel1AllowEntire: optBool,
    policyLevel2AllowEntire: optBool,
    policyLevel5AllowEntire: optBool,
    policyLevel6AllowEntire: optBool,
    customLevelRules: optJson,
    jobLevelPolicies: optJson,
    policyDepartmentClustering: optBool,
    policyStrictDepartmentSegregation: optBool,
    policyStrictGenderSegregation: optBool,
    policyStrictFamilySegregation: optBool,
    policyAdaptiveLearning: optBool,
    policyRequireExceptionApproval: optBool,
    visitMaxNights: optInt(0, 365),
    visitMaxVisitsPerYear: optInt(0, 365),
    visitMinServiceMonths: optInt(0, 600),
    visitCooldownDays: optInt(0, 3650),
    visitRequireNationalId: optBool,
    hostingRequestSignaturePolicy: optJson,
    curfewEnabled: optBool,
    curfewTime: optText(10),
    housingRulesText: optText(50000),
    familyVisitPolicyText: optText(50000),
    housingPolicyText: optText(50000),
    hrContact1Name: optText(200),
    hrContact1Title: optText(200),
    hrContact1Phone: optText(50),
    hrContact1Email: optText(200),
    hrContact2Name: optText(200),
    hrContact2Title: optText(200),
    hrContact2Phone: optText(50),
    hrContact2Email: optText(200),
    housingManager1Name: optText(200),
    housingManager1Title: optText(200),
    housingManager1Phone: optText(50),
    housingManager1Email: optText(200),
    housingManager2Name: optText(200),
    housingManager2Title: optText(200),
    housingManager2Phone: optText(50),
    housingManager2Email: optText(200),
  })
  .strip(); // drops any key not in the whitelist (replaces the old allowedFields loop)

export const TestEmailBody = z.object({
  toEmail: z.string().trim().email(),
  smtpHost: zText(255).optional(),
  smtpPort: z.coerce.number().int().min(1).max(65535).optional(),
  smtpSecure: optBool,
  smtpUser: zText(255).optional(),
  smtpPass: zText(500).optional(),
  smtpFrom: zText(255).optional(),
});

// ─── lookup_values.ts ────────────────────────────────────────────────────────
export const ListLookupQuery = z.object({ category: zText(100).optional() }).passthrough();

export const CreateLookupBody = z.object({
  category: zText(100).min(1),
  value: zText(500).optional(),
  valueAr: zText(500).optional(),
  parentValue: zNullableText(500).optional(),
  extraValue: zNullableText(2000).optional(),
  sortOrder: z.coerce.number().int().min(0).max(100000).optional(),
});

export const BulkLookupBody = z.object({
  items: z
    .array(
      z.object({
        category: zText(100).optional(),
        value: zText(500).optional(),
        valueAr: zText(500).optional(),
        parentValue: zNullableText(500).optional(),
        extraValue: zNullableText(2000).optional(),
        sortOrder: z.coerce.number().int().optional(),
      }),
    )
    .min(1)
    .max(5000),
});

export const UpdateLookupBody = z.object({
  value: zText(500).optional(),
  valueAr: zText(500).optional(),
  parentValue: z.union([z.string().max(500), z.null()]).optional(),
  extraValue: z.union([z.string().max(2000), z.null()]).optional(),
  disabled: optBool,
  sortOrder: z.coerce.number().int().min(0).max(100000).optional(),
});

// ─── documents.ts ────────────────────────────────────────────────────────────
export const CreateDocumentBody = z.object({
  propertyId: zId,
  titleAr: zText(180).min(1),
  titleEn: zNullableText(180).optional(),
  fileName: zText(180).min(1),
  fileType: zText(160).min(1),
  fileData: z.string().min(1),
  category: zText(80).optional(),
});

// ─── push-notifications.ts ───────────────────────────────────────────────────
export const PushSubscribeBody = z.object({
  endpoint: z.string().trim().url().max(2048),
  p256dhKey: zText(512).min(1),
  authKey: zText(256).min(1),
});

export const PushUnsubscribeBody = z.object({ endpoint: z.string().trim().min(1).max(2048) });

export const RegisterDeviceBody = z.object({
  token: zText(4096).min(10),
  platform: z.enum(["android", "ios", "web"]).optional().default("android"),
  deviceName: zText(200).optional(),
});

export const UnregisterDeviceBody = z.object({ token: zText(4096).min(1) });

// ─── workers.ts ──────────────────────────────────────────────────────────────
// Specialties are lookup-driven (dynamic keys), so only the shape is constrained.
const workerSpecialty = zText(50).min(1);
const workerStatus = z.enum(["available", "busy", "on_leave", "inactive"]);
const workerType = z.enum(["internal", "contractor"]);

export const ListWorkersQuery = paginationQuery(500, 50)
  .extend({
    search: zText(200).optional(),
    specialty: zText(50).optional(),
    status: zText(50).optional(),
    workerType: zText(50).optional(),
    department: zText(100).optional(),
    category: zText(100).optional(),
  })
  .passthrough();

export const CreateWorkerBody = z.object({
  name: zText(200).min(1),
  phone: zText(50).optional(),
  nationalId: zText(50).optional(),
  specialty: workerSpecialty.optional(),
  status: workerStatus.optional(),
  workerType: workerType.optional(),
  companyName: zText(200).optional(),
  dailyRate: z.coerce.number().min(0).max(1_000_000).optional(),
  notes: zText(2000).optional(),
  profileId: zOptionalId,
});

export const UpdateWorkerBody = CreateWorkerBody.partial();

// ─── gate.ts ─────────────────────────────────────────────────────────────────
export const GateVerifyBody = z.object({
  qrPayload: zText(2048).optional(),
  employeeId: z.union([z.string().trim().max(100), z.number()]).optional(),
  propertyId: zOptionalId,
});

export const GateLogBody = z.object({
  propertyId: zOptionalId,
  profileId: zOptionalId,
  employeeId: z.union([z.string().trim().min(1).max(100), z.number()]),
  fullName: zText(200).min(1),
  department: zNullableText(200).optional(),
  jobTitle: zNullableText(200).optional(),
  roomNumber: z.union([z.string().trim().max(50), z.number()]).nullable().optional(),
  buildingName: zNullableText(200).optional(),
  direction: z.enum(["IN", "OUT"]).default("IN"),
  status: z.enum(["GRANTED", "DENIED", "WARNING"]).default("GRANTED"),
  reason: zNullableText(500).optional(),
  scanMethod: zText(50).default("QR_SCAN"),
  notes: zNullableText(2000).optional(),
});

export const GateLogsQuery = paginationQuery(2000, 20)
  .extend({
    propertyId: z.union([z.literal("all"), z.coerce.number().int().positive()]).optional(),
    direction: z.enum(["IN", "OUT", "all"]).optional(),
    status: z.enum(["GRANTED", "DENIED", "WARNING", "all"]).optional(),
    search: zText(200).optional(),
    date: zOptionalDateString,
  })
  .passthrough();

export const GateStatsQuery = z.object({ date: zOptionalDateString }).passthrough();

// ─── portal-schedule.ts ──────────────────────────────────────────────────────
export const CreateCalendarEventBody = z
  .object({
    title: zText(300).optional(),
    titleAr: zText(300).optional(),
    type: zText(50).optional(),
    startTime: z.string().trim().max(64).optional(),
    location: zText(300).optional(),
    description: zText(5000).optional(),
  })
  .refine((v) => Boolean(v.title || v.titleAr), { message: "Title is required" });

export const SnoozeReminderBody = z.object({
  minutes: z.coerce.number().int().min(1).max(60 * 24 * 7).optional(),
});

// ─── reports.ts ──────────────────────────────────────────────────────────────
const reportDataSource = z.enum(["in_house", "profiles", "rooms", "reservations", "maintenance", "vacations", "hostings"]);

export const CreateReportTemplateBody = z.object({
  name: zText(200).min(1),
  nameEn: zNullableText(200).optional(),
  dataSource: reportDataSource,
  columns: z.array(z.string().max(100)).max(200).optional(),
  filters: z.record(z.any()).optional(),
  layoutOptions: z.record(z.any()).optional(),
});

export const UpdateReportTemplateBody = CreateReportTemplateBody.partial();

export const CustomReportQueryBody = z.object({
  dataSource: reportDataSource.default("in_house"),
  columns: z.array(z.string().max(100)).max(200).default([]),
  filters: z.record(z.any()).default({}),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(5000).default(20),
  sortBy: z.string().regex(/^[a-zA-Z0-9_]{1,64}$/).optional(),
  sortOrder: z.enum(["asc", "desc"]).default("asc"),
  fetchAll: zBool.default(false),
});

export const ReportsListQuery = paginationQuery(5000, 10)
  .extend({
    search: zText(200).optional(),
    tab: zText(50).optional(),
  })
  .passthrough();

export const RatingsReportQuery = paginationQuery(100, 20)
  .extend({
    propertyId: z.string().max(20).optional(),
    fromDate: zOptionalDateString,
    toDate: zOptionalDateString,
    rating: zText(20).optional(),
    category: zText(100).optional(),
  })
  .passthrough();

export const RoomMovesReportQuery = paginationQuery(100, 20)
  .extend({
    propertyId: z.string().max(20).optional(),
    fromDate: zOptionalDateString,
    toDate: zOptionalDateString,
    reasonCode: zText(100).optional(),
    building: zText(200).optional(),
    search: zText(200).optional(),
  })
  .passthrough();

export const VacationsReportQuery = z
  .object({
    search: zText(200).optional(),
    status: zText(50).optional(),
    department: zText(200).optional(),
    buildingId: zOptionalId,
    dateFrom: zOptionalDateString,
    dateTo: zOptionalDateString,
  })
  .passthrough();

// ─── room-import.ts ──────────────────────────────────────────────────────────
export const RoomImportExecuteBody = z.object({
  propertyId: zOptionalId,
  buildingId: zOptionalId,
  importMode: z.enum(["create_update", "create_only", "update_only", "replace"]).default("create_update"),
  fileName: zText(255).default("room_config.xlsx"),
  rooms: z.array(z.record(z.any())).min(1).max(20000),
});

export const SaveImportTemplateBody = z.object({
  propertyId: zOptionalId,
  name: zText(200).min(1),
  description: zText(1000).default(""),
  columnMapping: z.record(z.any()),
});

// ─── room-inventory.ts ───────────────────────────────────────────────────────
export const ListInventoryQuery = paginationQuery(5000, 50)
  .extend({
    roomId: zOptionalId,
    buildingId: zOptionalId,
    floorId: zOptionalId,
    category: zText(100).optional(),
    condition: zText(50).optional(),
    search: zText(200).optional(),
  })
  .passthrough();

export const CreateInventoryItemBody = z.object({
  roomId: zId,
  itemName: zText(200).min(1),
  category: zText(100).optional(),
  quantity: z.coerce.number().int().min(1).max(10000).optional(),
  condition: zText(50).optional(),
  barcode: zNullableText(200).optional(),
  serialNumber: zNullableText(200).optional(),
  modelNumber: zNullableText(200).optional(),
  notes: zNullableText(2000).optional(),
  inspectedBy: zNullableText(200).optional(),
  lastInspectedAt: z.union([zDateString, z.null(), z.literal("")]).optional(),
});

export const UpdateInventoryItemBody = CreateInventoryItemBody.omit({ roomId: true }).partial();

export const SyncInventoryBody = z.object({ roomId: zOptionalId });

export const CreateInventoryTicketBody = z.object({ reportedBy: zText(200).optional() });

// ─── whatsapp.ts ─────────────────────────────────────────────────────────────
export const WhatsAppConfigBody = z.object({
  provider: z.enum(["meta_cloud", "baileys"]).optional(),
  metaAccessToken: z.string().max(4096).optional(),
  metaPhoneNumberId: zText(64).optional(),
  metaWabaId: zText(64).optional(),
  isAutoSendEnabled: optBool,
  welcomeTemplateAr: z.string().max(5000).optional(),
  welcomeTemplateEn: z.string().max(5000).optional(),
  isReservationSendEnabled: optBool,
  reservationTemplateAr: z.string().max(5000).optional(),
  reservationTemplateEn: z.string().max(5000).optional(),
  supervisorContact: zText(100).optional(),
});

export const WhatsAppTestBody = z.object({
  phone: zText(32).min(8),
  message: z.string().max(5000).optional(),
  language: z.enum(["ar", "en"]).optional(),
});

export const WhatsAppLogsQuery = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(5).max(100).default(10),
  })
  .passthrough();

export const BroadcastPreviewBody = z.object({
  targetType: z.enum(["ALL", "BUILDING", "FLOOR", "ROOMS", "INDIVIDUALS", "SELECTED"]).optional(),
  buildingId: zOptionalId,
  floorId: zOptionalId,
  roomIds: z.array(z.coerce.number().int().positive()).max(5000).optional(),
  profileIds: z.array(z.coerce.number().int().positive()).max(5000).optional(),
});

export const BroadcastSendBody = z.object({
  messageText: z.string().trim().min(1).max(5000),
  recipients: z
    .array(
      z.object({
        profileId: z.coerce.number().int().positive(),
        name: zText(200).optional(),
        phone: zText(32).optional(), // recipients without a phone are filtered by the handler
        roomNumber: z.union([z.string().max(50), z.number()]).optional(),
        buildingName: zText(200).optional(),
        floorName: zText(100).optional(),
      }),
    )
    .min(1)
    .max(5000),
});

// ─── dashboard.ts / portal-analytics.ts ──────────────────────────────────────
export const DashboardActivityQuery = z.object({ limit: z.coerce.number().int().min(1).max(200).default(20) }).passthrough();

export const DashboardHorizonQuery = z
  .object({ horizon: z.enum(["today", "7d", "30d", "quarter"]).default("7d") })
  .passthrough();

export const AnalyticsDaysQuery = z.object({ days: z.coerce.number().int().min(1).max(365).default(30) }).passthrough();

// ─────────────────────────────────────────────────────────────────────────────
// Route-parameter and list-query guards (AGENTS.md Rule 2, layer 3).
// Values stay strings — handlers keep parsing them as before — but malformed
// input is rejected with a bilingual 400 instead of reaching SQL as NaN.
// ─────────────────────────────────────────────────────────────────────────────
const numericIdParam = z.string().regex(/^[1-9]\d{0,9}$/, "must be a positive integer");
const numericParams = <K extends string>(...keys: K[]) =>
  z.object(Object.fromEntries(keys.map((k) => [k, numericIdParam])) as Record<K, typeof numericIdParam>).passthrough();

export const IdParams = numericParams("id");
export const RoomIdParams = numericParams("roomId");
export const IdCompanionIdParams = numericParams("id", "companionId");
/** Hosting requests accept the numeric id or the request number (e.g. "HR-2026-0001"). */
export const RequestRefParams = z.object({ id: z.string().regex(/^[A-Za-z0-9_-]{1,64}$/) }).passthrough();
/** BullMQ job ids. */
export const JobIdParams = z.object({ id: z.string().regex(/^[\w:.-]{1,128}$/) }).passthrough();
/** Employee/profile codes (alphanumeric codes, not database ids). */
export const ProfileCodeParams = z.object({ profileId: z.string().min(1).max(100) }).passthrough();
export const ClockNumberParams = z.object({ clockNumber: z.string().min(1).max(100) }).passthrough();
export const FeedbackContentParams = z
  .object({
    contentType: z.enum(["activity", "evaluation", "document", "accommodation", "services"]),
    contentId: z.string().regex(/^\d{1,10}$/, "must be a non-negative integer"),
  })
  .passthrough();

const digitsQuery = z.string().regex(/^\d{1,6}$/, "must be a whole number");
/** Common list-query keys; any other key passes through untouched for the handler. */
export const CommonListQuery = z
  .object({
    page: digitsQuery.optional(),
    limit: digitsQuery.optional(),
    search: z.string().max(200).optional(),
  })
  .passthrough();

// ─────────────────────────────────────────────────────────────────────────────
// Request-body guards for routes that previously read req.body unchecked.
// Every field is optional and nothing is coerced: handlers keep their own
// "required" checks and messages. These schemas only reject malformed input —
// objects/arrays where scalars are expected, oversized text, huge lists.
// Unknown keys pass through untouched.
// ─────────────────────────────────────────────────────────────────────────────
const bId = z.union([z.number().int().nonnegative(), z.string().regex(/^\d{1,10}$/)]);
const bIds = (max = 1000) => z.array(bId).max(max);
const bText = (max = 500) => z.string().max(max);
const bScalar = (max = 500) => z.union([z.string().max(max), z.number(), z.boolean()]);
const bDate = z.string().max(40);
const bBool = z.union([z.boolean(), z.enum(["true", "false"]), z.literal(0), z.literal(1)]);
const bNum = z.union([z.number(), z.string().regex(/^-?\d{1,9}(\.\d+)?$/)]);
const bDataUrl = z.string().max(20 * 1024 * 1024); // base64 images / attachments
const o = <T extends z.ZodTypeAny>(s: T) => s.nullable().optional();
const body = (shape: z.ZodRawShape) => z.object(shape).passthrough();

// assignments / reservations
export const SendWhatsAppBody = body({ phone: o(bScalar(30)) });
export const BulkIdsBody = body({ ids: o(bIds()) });
export const ReservationCheckoutBody = body({ checkOutDate: o(bDate), notes: o(bText(2000)), reason: o(bText(500)) });
// auth
export const SwitchPropertyBody = body({ propertyId: o(bId) });
export const ForgotOtpRequestBody = body({ identifier: o(bText(200)) });
export const ForgotOtpVerifyBody = body({ identifier: o(bText(200)), otp: o(bScalar(12)) });
export const ForgotResetBody = body({ identifier: o(bText(200)), resetToken: o(bText(500)), newPassword: o(bText(200)) });
export const LastPropertyBody = body({ propertyId: o(bId) });
// evaluations
export const HousingPulseConfigBody = body({
  enabled: o(bBool), ratingType: o(bText(40)), allowComment: o(bBool), commentRequired: o(bBool),
  cooldownDays: o(bNum), titleAr: o(bText(300)), titleEn: o(bText(300)), questionAr: o(bText(1000)), questionEn: o(bText(1000)),
});
// hostings
export const CompanionBody = body({
  name: o(bText(200)), relation: o(bText(100)), idNumber: o(bScalar(60)), age: o(bNum), isChild: o(bBool),
  documentType: o(bText(60)), documentFileName: o(bText(300)), documentImage: o(bDataUrl),
});
// hotek / smart locks
export const PropertyScopedBody = body({ propertyId: o(bId) });
export const LockUpdateBody = body({ propertyId: o(bId), protocol: o(bText(60)), status: o(bText(40)) });
export const KeyRevokeBody = body({ propertyId: o(bId), type: o(bText(40)) });
export const KeyExtendBody = body({ propertyId: o(bId), expiresAt: o(bDate) });
// HR sync / eSign (external integrations — record payloads stay flexible)
const hrRecords = z.array(z.record(z.any())).max(20000);
export const HrReceiveBody = body({
  propertyId: o(bId), profiles: o(hrRecords), employees: o(hrRecords), data: o(z.union([hrRecords, z.record(z.any())])),
  mapping: o(z.record(z.any())), syncProfiles: o(bBool), allowedLevels: o(z.array(bScalar(100)).max(500)),
  allowedDepartments: o(z.array(bScalar(200)).max(500)), housingEligibleOnly: o(bBool), scope: o(bText(40)),
});
export const HrSyncRunBody = body({ sourceId: o(bId), scope: o(bText(40)) });
export const HrTestConnectionBody = body({ apiUrl: o(bText(2000)), apiKey: o(bText(2000)) });
export const HrNotifyVacationBody = body({
  propertyId: o(bId), profileId: o(bScalar(100)), employeeId: o(bScalar(100)), type: o(bText(60)),
  startDate: o(bDate), endDate: o(bDate), notes: o(bText(2000)),
});
export const HrNotifyDepartureBody = body({
  propertyId: o(bId), profileId: o(bScalar(100)), employeeId: o(bScalar(100)), departureDate: o(bDate), reason: o(bText(2000)),
});
export const EsignTestBody = body({ baseUrl: o(bText(2000)), hotelCode: o(bScalar(60)), username: o(bText(200)), password: o(bText(500)) });
export const EsignRangeSyncBody = body({
  fromClockNo: o(bScalar(60)), from: o(bScalar(60)), toClockNo: o(bScalar(60)), to: o(bScalar(60)), hotelCode: o(bScalar(60)), sourceId: o(bId),
});
export const EsignRefreshBody = body({ sourceId: o(bId) });
// maintenance
export const PropertyIdOnlyBody = body({ propertyId: o(bId) });
export const SubTicketBody = body({
  propertyId: o(bId), problemType: o(bText(200)), description: o(bText(5000)), priority: o(bText(40)), roomId: o(bId), category: o(bText(100)),
});
// portal chat
export const CreateConversationBody = body({ participantIds: o(bIds(200)), subject: o(bText(300)) });
export const ChatMessageBody = body({ content: o(z.string().max(20 * 1024 * 1024)), contentType: o(bText(40)) });
export const AdminChatMessageBody = body({ content: o(z.string().max(20 * 1024 * 1024)) });
// portal data
export const ActivityRegistrationBody = body({ activityId: o(bId), status: o(bText(40)), badgeNumber: o(bScalar(60)) });
export const ActivityCancelBody = body({ activityId: o(bId) });
export const ActivityAttendanceBody = body({ registrationId: o(bId), attended: o(bBool) });
export const EvaluationRespondBody = body({
  profileRating: o(bNum), employeeRating: o(bNum), profileResponse: o(bText(5000)), employeeResponse: o(bText(5000)),
  itemResponses: o(z.union([z.array(z.record(z.any())).max(500), z.record(z.any())])),
});
export const HousingRatingBody = body({ rating: o(bScalar(40)), score: o(bNum), comment: o(bText(5000)) });
export const MyProfileBody = body({
  phone: o(bScalar(30)), address: o(bText(1000)), photo: o(bDataUrl), email: o(bText(320)), emergencyContact: o(bText(500)),
});
// portal food / transport
export const FoodOrderBody = body({ menuItemId: o(bId), quantity: o(bNum), orderDate: o(bDate), notes: o(bText(1000)) });
export const TransportBookingBody = body({ scheduleId: o(bId), bookingDate: o(bDate) });
// profiles
export const ProfilesBulkBody = body({ profiles: o(z.array(z.record(z.any())).max(20000)) });
export const ProfilePhotoBody = body({ photoUrl: o(bDataUrl) });
export const ProfileIdImageBody = body({ idImage: o(bDataUrl) });
export const VacationStartBody = body({ startDate: o(bDate), endDate: o(bDate), notes: o(bText(2000)) });
export const VacationReturnBody = body({ returnDate: o(bDate) });
// rooms
export const RoomFeaturesBody = body({ features: o(bText(5000)), featuresList: o(z.array(bText(200)).max(200)) });
export const RoomStatusBody = body({ status: o(bText(40)) });
// users
export const UsersBulkBody = body({ ids: o(bIds()), action: o(bText(60)), role: o(bText(60)), propertyIds: o(bIds(500)), status: o(bText(40)) });
// whatsapp
export const WhatsAppConnectBody = body({ phoneNumber: o(bScalar(30)), resetSession: o(bBool) });

// ─── GET /api/reports/rows/:report (server-side report pages) ───────────────
const qText = (max: number) => z.string().max(max).optional();
export const SERVER_REPORTS = [
  "arrivals_manifest", "departures_manifest", "housekeeping_sheet", "room_discrepancy",
  "daily_movement", "assignments", "vacant_rooms", "housing", "department_occupancy",
  "profiles", "expiring_contracts", "hostings", "vacations", "maintenance",
  "equipment_inventory", "water_distribution", "gate_logs", "police_report", "policy_exceptions",
] as const;
export const ReportRowsParams = z.object({ report: z.enum(SERVER_REPORTS) });
export const ReportFilterOptionsQuery = z.object({ propertyId: z.string().regex(/^\d{1,10}$/) }).passthrough();
export const ReportRowsQuery = z
  .object({
    propertyId: z.string().regex(/^\d{1,10}$/),
    page: z.string().regex(/^\d{1,6}$/).optional(),
    limit: z.string().regex(/^\d{1,4}$/).optional(),
    all: z.enum(["0", "1"]).optional(),
    lang: z.enum(["ar", "en"]).optional(),
    search: qText(200),
    sortKey: z.string().regex(/^[A-Za-z0-9_]{1,64}$/).optional(),
    sortDir: z.enum(["asc", "desc"]).optional(),
    groupBy: z.enum(["room"]).optional(),
    filterBuilding: qText(20),
    filterFloor: qText(20),
    filterStatus: qText(40),
    filterCategory: qText(100),
    filterDepartment: qText(200),
    filterGender: qText(20),
    filterNationality: qText(100),
    filterRoomType: qText(100),
    filterEmploymentType: qText(40),
    dateFrom: qText(40),
    dateTo: qText(40),
    inventoryViewMode: z.enum(["summary", "detailed", "items"]).optional(),
    waterSortMode: qText(20),
    tz: z.string().regex(/^[A-Za-z0-9_+\-/]{1,64}$/).optional(),
  })
  .passthrough();

// ─── GET /api/reports/analytics ─────────────────────────────────────────────
export const ReportAnalyticsQuery = z
  .object({
    propertyId: z.string().regex(/^\d{1,10}$/),
    lang: z.enum(["ar", "en"]).optional(),
    filterBuilding: z.string().max(20).optional(),
    filterFloor: z.string().max(20).optional(),
    tz: z.string().regex(/^[A-Za-z0-9_+\-/]{1,64}$/).optional(),
  })
  .passthrough();
