import { sql, or, ilike, and, type SQL } from "drizzle-orm";

/**
 * Normalizes an Arabic/English search string:
 * - Trims and lowercases
 * - Removes Arabic tashkeel / diacritics
 * - Normalizes alef variants: أ, إ, آ, ٱ -> ا
 * - Normalizes taa marbuta: ة -> ه
 * - Normalizes alif maqsura: ى -> ي
 * - Collapses whitespace
 */
export function normalizeSearchString(text: unknown): string {
  if (text == null) return "";
  let s = String(text).trim().toLowerCase();
  s = s.replace(/[\u064B-\u065F\u0670]/g, "");
  s = s.replace(/[أإآٱ]/g, "ا");
  s = s.replace(/ة/g, "ه");
  s = s.replace(/ى/g, "ي");
  s = s.replace(/\s+/g, " ");
  return s;
}

/**
 * Returns a PostgreSQL SQL expression that normalizes an Arabic text column:
 * Removes tashkeel, maps [أإآٱ] to 'ا', 'ة' to 'ه', 'ى' to 'ي', and converts to lowercase.
 */
export function sqlNormalizeArabic(columnSql: any): SQL {
  return sql`translate(lower(coalesce(${columnSql}, '')), 'أإآٱةىًٌٍَُِّْ', 'ااااهي')`;
}

/**
 * Builds multi-token search conditions for profiles table.
 * Every word typed by the user must match at least one profile attribute
 * (Full Name Ar, Full Name En, Profile ID, National ID, Phone, Email, Department, Job Title, Nationality).
 */
export function buildProfileSearchConditions(
  searchQuery: string,
  profilesTable: any,
): SQL | null {
  const norm = normalizeSearchString(searchQuery);
  const tokens = norm.split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return null;

  const arFullNameSql = sqlNormalizeArabic(
    sql`concat_ws(' ', ${profilesTable.firstNameAr}, ${profilesTable.lastNameAr}, ${profilesTable.thirdNameAr}, ${profilesTable.fourthNameAr})`
  );
  const enFullNameSql = sql`lower(concat_ws(' ', coalesce(${profilesTable.firstName}, ''), coalesce(${profilesTable.lastName}, ''), coalesce(${profilesTable.thirdName}, ''), coalesce(${profilesTable.fourthName}, '')))` ;

  const arDeptSql = sqlNormalizeArabic(profilesTable.departmentAr);
  const arJobSql = sqlNormalizeArabic(profilesTable.jobTitleAr);

  const tokenConditions: SQL[] = tokens.map((token) => {
    const pattern = `%${token}%`;
    return or(
      sql`${arFullNameSql} ILIKE ${pattern}`,
      sql`${enFullNameSql} ILIKE ${pattern}`,
      ilike(profilesTable.profileId, pattern),
      ilike(profilesTable.nationalId, pattern),
      ilike(profilesTable.phone, pattern),
      ilike(profilesTable.email, pattern),
      ilike(profilesTable.department, pattern),
      sql`${arDeptSql} ILIKE ${pattern}`,
      ilike(profilesTable.jobTitle, pattern),
      sql`${arJobSql} ILIKE ${pattern}`,
      ilike(profilesTable.nationality, pattern),
    )!;
  });

  return and(...tokenConditions)!;
}

/**
 * Builds multi-token search conditions for assignments / in-house records.
 * Matches employee attributes PLUS room number, building name, bed number.
 */
export function buildAssignmentSearchConditions(
  searchQuery: string,
  tables: {
    profilesTable: any;
    roomsTable: any;
    buildingsTable: any;
    assignmentsTable?: any;
  },
): SQL | null {
  const { profilesTable, roomsTable, buildingsTable, assignmentsTable } = tables;
  const norm = normalizeSearchString(searchQuery);
  const tokens = norm.split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return null;

  const arFullNameSql = sqlNormalizeArabic(
    sql`concat_ws(' ', ${profilesTable.firstNameAr}, ${profilesTable.lastNameAr}, ${profilesTable.thirdNameAr}, ${profilesTable.fourthNameAr})`
  );
  const enFullNameSql = sql`lower(concat_ws(' ', coalesce(${profilesTable.firstName}, ''), coalesce(${profilesTable.lastName}, ''), coalesce(${profilesTable.thirdName}, ''), coalesce(${profilesTable.fourthName}, '')))` ;

  const arDeptSql = sqlNormalizeArabic(profilesTable.departmentAr);
  const arJobSql = sqlNormalizeArabic(profilesTable.jobTitleAr);
  const arBldgSql = sqlNormalizeArabic(buildingsTable.name);

  const tokenConditions: SQL[] = tokens.map((token) => {
    const pattern = `%${token}%`;
    const checks: SQL[] = [
      sql`${arFullNameSql} ILIKE ${pattern}`,
      sql`${enFullNameSql} ILIKE ${pattern}`,
      ilike(profilesTable.profileId, pattern),
      ilike(profilesTable.nationalId, pattern),
      ilike(profilesTable.phone, pattern),
      ilike(profilesTable.department, pattern),
      sql`${arDeptSql} ILIKE ${pattern}`,
      ilike(profilesTable.jobTitle, pattern),
      sql`${arJobSql} ILIKE ${pattern}`,
      ilike(roomsTable.roomNumber, pattern),
      sql`${arBldgSql} ILIKE ${pattern}`,
    ];

    if (assignmentsTable?.bedNumber) {
      checks.push(sql`cast(${assignmentsTable.bedNumber} as text) ILIKE ${pattern}`);
    }

    return or(...checks)!;
  });

  return and(...tokenConditions)!;
}

/**
 * Builds multi-token search conditions for reservations table.
 */
export function buildReservationSearchConditions(
  searchQuery: string,
  tables: {
    reservationsTable: any;
    roomsTable?: any;
    buildingsTable?: any;
  },
): SQL | null {
  const { reservationsTable, roomsTable, buildingsTable } = tables;
  const norm = normalizeSearchString(searchQuery);
  const tokens = norm.split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return null;

  const guestNameEnSql = sql`lower(concat_ws(' ', coalesce(${reservationsTable.firstName}, ''), coalesce(${reservationsTable.lastName}, '')))` ;
  const guestNameArSql = sqlNormalizeArabic(
    sql`concat_ws(' ', ${reservationsTable.firstName}, ${reservationsTable.lastName})`
  );
  const deptArSql = sqlNormalizeArabic(reservationsTable.department);
  const jobArSql = sqlNormalizeArabic(reservationsTable.jobTitle);

  const tokenConditions: SQL[] = tokens.map((token) => {
    const pattern = `%${token}%`;
    const checks: SQL[] = [
      sql`${guestNameEnSql} ILIKE ${pattern}`,
      sql`${guestNameArSql} ILIKE ${pattern}`,
      ilike(reservationsTable.guestPhone, pattern),
      ilike(reservationsTable.guestIdCardNumber, pattern),
      ilike(reservationsTable.department, pattern),
      sql`${deptArSql} ILIKE ${pattern}`,
      ilike(reservationsTable.jobTitle, pattern),
      sql`${jobArSql} ILIKE ${pattern}`,
      ilike(reservationsTable.profileCode, pattern),
      ilike(reservationsTable.nationality, pattern),
      ilike(reservationsTable.notes, pattern),
      sql`cast(${reservationsTable.id} as text) ILIKE ${pattern}`,
    ];

    if (roomsTable?.roomNumber) {
      checks.push(ilike(roomsTable.roomNumber, pattern));
    }
    if (buildingsTable?.name) {
      checks.push(sql`${sqlNormalizeArabic(buildingsTable.name)} ILIKE ${pattern}`);
    }

    return or(...checks)!;
  });

  return and(...tokenConditions)!;
}

/**
 * Builds multi-token search conditions for maintenance tickets.
 */
export function buildMaintenanceSearchConditions(
  searchQuery: string,
  tables: {
    maintenanceTicketsTable: any;
    roomsTable?: any;
    buildingsTable?: any;
  },
): SQL | null {
  const { maintenanceTicketsTable, roomsTable, buildingsTable } = tables;
  const norm = normalizeSearchString(searchQuery);
  const tokens = norm.split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return null;

  const titleSql = sqlNormalizeArabic(maintenanceTicketsTable.title);
  const descSql = sqlNormalizeArabic(maintenanceTicketsTable.description);
  const reqNameSql = sqlNormalizeArabic(maintenanceTicketsTable.requesterName);

  const tokenConditions: SQL[] = tokens.map((token) => {
    const pattern = `%${token}%`;
    const checks: SQL[] = [
      sql`cast(${maintenanceTicketsTable.id} as text) ILIKE ${pattern}`,
      sql`${titleSql} ILIKE ${pattern}`,
      sql`${descSql} ILIKE ${pattern}`,
      sql`${reqNameSql} ILIKE ${pattern}`,
      ilike(maintenanceTicketsTable.category, pattern),
      ilike(maintenanceTicketsTable.priority, pattern),
      ilike(maintenanceTicketsTable.status, pattern),
    ];

    if (roomsTable?.roomNumber) {
      checks.push(ilike(roomsTable.roomNumber, pattern));
    }
    if (buildingsTable?.name) {
      checks.push(sql`${sqlNormalizeArabic(buildingsTable.name)} ILIKE ${pattern}`);
    }

    return or(...checks)!;
  });

  return and(...tokenConditions)!;
}

/**
 * Builds multi-token search conditions for rooms table.
 */
export function buildRoomSearchConditions(
  searchQuery: string,
  roomsTable: any,
): SQL | null {
  const norm = normalizeSearchString(searchQuery);
  const tokens = norm.split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return null;

  const roomTypeSql = sqlNormalizeArabic(roomsTable.roomType);
  const notesSql = sqlNormalizeArabic(roomsTable.notes);

  const tokenConditions: SQL[] = tokens.map((token) => {
    const pattern = `%${token}%`;
    return or(
      ilike(roomsTable.roomNumber, pattern),
      ilike(roomsTable.roomType, pattern),
      sql`${roomTypeSql} ILIKE ${pattern}`,
      ilike(roomsTable.features, pattern),
      ilike(roomsTable.bedType, pattern),
      sql`${notesSql} ILIKE ${pattern}`,
      sql`cast(${roomsTable.capacity} as text) = ${token}`,
    )!;
  });

  return and(...tokenConditions)!;
}
