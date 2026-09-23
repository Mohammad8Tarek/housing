import { pool, withTenant, profilesTable, propertiesTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { logger } from "./logger.js";
import { enrichProfileBilingual } from "./bilingual-translator.js";

export interface SunriseEsignConfig {
  baseUrl?: string;
  username?: string;
  password?: string;
  hotelCode?: string;
  hotelId?: number | null;
  isActive?: boolean;
}

export interface NormalizedEsignEmployee {
  profileId: string;
  firstName: string;
  lastName: string;
  thirdName: string;
  fourthName: string;
  firstNameAr: string;
  lastNameAr: string;
  thirdNameAr: string;
  fourthNameAr: string;
  nationalId: string;
  nationality: string;
  address: string;
  jobTitle: string;
  jobTitleAr: string;
  level: string;
  phone: string;
  department: string;
  departmentAr: string;
  hireDate: string;
  dateOfBirth: string;
  gender: "M" | "F";
  contractEndDate: string | null;
  email: string;
  emergencyContact: string;
  raw: any;
}

// In-memory token cache to prevent repeated login overhead
interface CachedAuth {
  token: string;
  cachedAt: number;
}
const tokenCache = new Map<string, CachedAuth>();
const hotelIdCache = new Map<string, number>();

const DEFAULT_BASE_URL = "https://signature-backend.sunrise-resorts.com/api";

/**
 * Load Sunrise e-Signature config for a given property (or global)
 */
export async function getEsignConfig(propertyId?: number | null): Promise<SunriseEsignConfig | null> {
  try {
    const client = await pool.connect();
    try {
      let res;
      if (propertyId) {
        res = await client.query(
          "SELECT esign_config FROM public.hr_sync_config WHERE property_id = $1 LIMIT 1",
          [propertyId],
        );
      }
      if (!res || res.rows.length === 0 || !res.rows[0]?.esign_config || Object.keys(res.rows[0].esign_config).length === 0) {
        res = await client.query(
          "SELECT esign_config FROM public.hr_sync_config WHERE esign_config IS NOT NULL AND esign_config != '{}'::jsonb ORDER BY id ASC LIMIT 1",
        );
      }
      if (res && res.rows.length > 0 && res.rows[0]?.esign_config) {
        return res.rows[0].esign_config as SunriseEsignConfig;
      }
    } finally {
      client.release();
    }
  } catch (err) {
    logger.warn({ err }, "[SunriseEsignService] Failed to load esign config from DB");
  }
  return null;
}

/**
 * Authenticate with Sunrise e-Signature backend and return Bearer token
 */
export async function authenticateEsign(config: SunriseEsignConfig, forceRefresh = false): Promise<string> {
  const baseUrl = (config.baseUrl || DEFAULT_BASE_URL).replace(/\/+$/, "");
  const username = (config.username || "").trim();
  const password = (config.password || "").trim();

  if (!username || !password) {
    throw new Error("بيانات الدخول (اسم المستخدم وكلمة المرور) لسيرفر Sunrise e-Signature غير مكتملة");
  }

  const cacheKey = `${baseUrl}:${username}`;
  const now = Date.now();

  if (!forceRefresh) {
    const cached = tokenCache.get(cacheKey);
    // Reuse token for 12 hours
    if (cached && now - cached.cachedAt < 12 * 60 * 60 * 1000) {
      return cached.token;
    }
  }

  const loginUrl = `${baseUrl}/login`;
  const res = await fetch(loginUrl, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email: username, password }),
  });

  const body = (await res.json().catch(() => ({}))) as any;

  if (!res.ok) {
    const msg = body?.message || res.statusText || "فشل تسجيل الدخول في سيرفر Sunrise e-Signature";
    throw new Error(`[Sunrise e-Signature Login 401] ${msg}`);
  }

  const token = body?.access_token;
  if (!token) {
    throw new Error(body?.message || "لم يقم سيرفر Sunrise e-Signature بإرجاع رمز الدخول access_token");
  }

  tokenCache.set(cacheKey, { token, cachedAt: now });
  return token;
}

/**
 * Resolve hotel ID from hotel code
 */
export async function resolveHotelId(config: SunriseEsignConfig, token: string, hotelCodeOverride?: string): Promise<{ id: number; name: string; code: string }> {
  const baseUrl = (config.baseUrl || DEFAULT_BASE_URL).replace(/\/+$/, "");
  const hotelCode = (hotelCodeOverride || config.hotelCode || "").trim().toUpperCase();

  if (!hotelCode) {
    throw new Error("كود الفندق (Hotel Code) غير محدد في إعدادات الربط");
  }

  const cacheKey = `${baseUrl}:${hotelCode}`;
  if (hotelIdCache.has(cacheKey) && !hotelCodeOverride) {
    return { id: hotelIdCache.get(cacheKey)!, name: hotelCode, code: hotelCode };
  }

  const url = `${baseUrl}/hotels/getbycode/${encodeURIComponent(hotelCode)}`;
  const res = await fetch(url, {
    method: "GET",
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${token}`,
    },
  });

  const body = (await res.json().catch(() => ({}))) as any;

  if (!res.ok || !body?.data?.id) {
    throw new Error(body?.message || `لم يتم العثور على الفندق ذو الكود "${hotelCode}" في نظام الموارد البشرية`);
  }

  const hotelId = Number(body.data.id);
  const hotelName = body.data.name || hotelCode;
  hotelIdCache.set(cacheKey, hotelId);

  return { id: hotelId, name: hotelName, code: hotelCode };
}

/**
 * Split full name into name parts (first, second/third, last)
 */
function splitFullName(fullName: string): { first: string; second: string; third: string; last: string } {
  const parts = (fullName || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (parts.length === 0) return { first: "", second: "", third: "", last: "" };
  if (parts.length === 1) return { first: parts[0], second: "", third: "", last: "" };
  if (parts.length === 2) return { first: parts[0], second: "", third: "", last: parts[1] };
  if (parts.length === 3) return { first: parts[0], second: parts[1], third: "", last: parts[2] };

  return {
    first: parts[0],
    second: parts[1],
    third: parts[2],
    last: parts.slice(3).join(" "),
  };
}

/**
 * Normalize raw employee record from Sunrise e-Signature into standard profile format
 */
export function normalizeEsignRecord(raw: any): NormalizedEsignEmployee {
  const employeeCode = raw.EmployeeCode ?? raw.clock_no ?? raw.clockNumber ?? "";
  const profileId = String(employeeCode).trim();

  // English Name decomposition
  const enSplit = splitFullName(raw.Name || "");
  // Arabic Name decomposition
  const arSplit = splitFullName(raw.Arabic_Name || "");

  // Gender normalization: 1 = Male (M), 2 = Female (F)
  const rawSex = raw.Sex ?? raw.gender ?? 1;
  const gender: "M" | "F" =
    rawSex === 2 || rawSex === "2" || String(rawSex).toUpperCase().startsWith("F") || String(rawSex).includes("أنثى")
      ? "F"
      : "M";

  // Level code
  const level = raw.LevelCode !== undefined && raw.LevelCode !== null ? String(raw.LevelCode).trim() : "";

  // Dates
  const hireDate = raw.HiringDate ? String(raw.HiringDate).split("T")[0] : new Date().toISOString().split("T")[0];
  const dateOfBirth = raw.BirthDate ? String(raw.BirthDate).split("T")[0] : "";
  const contractEndDate = raw.ContractExpireDate ? String(raw.ContractExpireDate).split("T")[0] : null;

  // Phone / Mobile
  const phone = String(raw.Mobile || raw.phone || "").trim();

  // Titles & Departments
  const jobTitle = String(raw.position_name || raw.PositionCode || "").trim();
  const jobTitleAr = String(raw.ar_position_name || "").trim();
  const department = String(raw.department_name || raw.section_name || raw.DepartmentCode || "").trim();
  const departmentAr = String(raw.section_name || "").trim();

  // Address & Nationality
  const address = String(raw.ArabicFullAddress || raw.address || "").trim();
  const nationality = String(raw.nationality_name || raw.ar_nationality_name || raw.CountryName || "Egyptian").trim();
  const nationalId = String(raw.NationalId || raw.national_id || raw.NationalID || profileId).trim();

  const normalized: NormalizedEsignEmployee = {
    profileId,
    firstName: enSplit.first || arSplit.first,
    lastName: enSplit.last || arSplit.last,
    thirdName: enSplit.third || arSplit.third,
    fourthName: enSplit.second || arSplit.second,
    firstNameAr: arSplit.first,
    lastNameAr: arSplit.last,
    thirdNameAr: arSplit.third,
    fourthNameAr: arSplit.second,
    nationalId,
    nationality,
    address,
    jobTitle,
    jobTitleAr,
    level,
    phone,
    department,
    departmentAr,
    hireDate,
    dateOfBirth,
    gender,
    contractEndDate,
    email: raw.email || "",
    emergencyContact: raw.emergency_contact || "",
    raw,
  };

  return enrichProfileBilingual(normalized as any) as any;
}

/**
 * Fetch a single employee by Employee Code / Clock Number
 */
export async function fetchEmployeeByCode(
  config: SunriseEsignConfig,
  clockNo: string | number,
  hotelCodeOverride?: string,
): Promise<NormalizedEsignEmployee | null> {
  const cleanCode = String(clockNo).trim();
  if (!cleanCode) return null;

  let token = await authenticateEsign(config);
  const baseUrl = (config.baseUrl || DEFAULT_BASE_URL).replace(/\/+$/, "");

  let hotel = await resolveHotelId(config, token, hotelCodeOverride);
  const url = `${baseUrl}/hotels/getEmploye/${hotel.id}/${encodeURIComponent(cleanCode)}`;

  let res = await fetch(url, {
    method: "GET",
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${token}`,
    },
  });

  // If 401 unauthenticated, refresh token once and retry
  if (res.status === 401) {
    token = await authenticateEsign(config, true);
    hotel = await resolveHotelId(config, token, hotelCodeOverride);
    res = await fetch(`${baseUrl}/hotels/getEmploye/${hotel.id}/${encodeURIComponent(cleanCode)}`, {
      method: "GET",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
      },
    });
  }

  if (res.status === 500) {
    const errBody = (await res.json().catch(() => ({}))) as any;
    throw new Error(errBody?.message || "خطأ في سيرفر الـ HR الفندقي");
  }

  const body = (await res.json().catch(() => ({}))) as any;

  // 200 OK with data: null means employee code not found at this hotel
  if (!body?.data || typeof body.data !== "object") {
    return null;
  }

  return normalizeEsignRecord(body.data);
}

/**
 * Test credentials and hotel code connection
 */
export async function testEsignConnection(config: SunriseEsignConfig): Promise<{
  success: boolean;
  message: string;
  hotelId?: number;
  hotelName?: string;
  hotelCode?: string;
  user?: any;
}> {
  const token = await authenticateEsign(config, true);
  const hotel = await resolveHotelId(config, token);

  return {
    success: true,
    message: `تم الاتصال بنجاح مع سيرفر Sunrise e-Signature بالفندق "${hotel.name}" (كود: ${hotel.code}، معرف: ${hotel.id})`,
    hotelId: hotel.id,
    hotelName: hotel.name,
    hotelCode: hotel.code,
  };
}
