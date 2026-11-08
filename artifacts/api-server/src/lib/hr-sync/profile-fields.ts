/**
 * hr-sync/profile-fields.ts — HR payload normalisation: status mapping and field extraction.
 */
import { splitCompoundName } from "../bilingual-translator.js";

// ============================================================================
// Helper: Status Normalization
// ============================================================================
export function normalizeHrStatus(
  rawStatus?: string | null,
): "ACTIVE" | "VACATION" | "DEPARTED" | "UNASSIGNED" {
  if (!rawStatus) return "ACTIVE";
  const s = String(rawStatus).trim().toLowerCase();

  // Vacation / Leave
  if (
    s === "vacation" ||
    s === "on_leave" ||
    s === "on-leave" ||
    s === "leave" ||
    s === "annual_leave" ||
    s === "sick_leave" ||
    s.includes("إجازة") ||
    s.includes("اجازة")
  ) {
    return "VACATION";
  }

  // Departed / Terminated / Left / Resigned / Clearance
  if (
    s === "departed" ||
    s === "terminated" ||
    s === "resigned" ||
    s === "inactive" ||
    s === "left" ||
    s === "fired" ||
    s === "ended" ||
    s.includes("تصفية") ||
    s.includes("مستقيل") ||
    s.includes("مفصول") ||
    s.includes("إنهاء") ||
    s.includes("انهاء") ||
    s.includes("استقالة")
  ) {
    return "DEPARTED";
  }

  if (s === "unassigned") return "UNASSIGNED";

  return "ACTIVE";
}

// ============================================================================
// Helper: Extract and map all profile fields
// ============================================================================
export function extractProfileFields(
  raw: any,
  mapping: Record<string, string> = {},
) {
  // Fast case-insensitive normalized lookup map for raw keys (ignores case, spaces, underscores, hyphens)
  const normalizedRawKeys = new Map<string, any>();
  if (raw && typeof raw === "object") {
    for (const [k, v] of Object.entries(raw)) {
      if (v !== undefined && v !== null && String(v).trim() !== "") {
        const cleanK = k.toLowerCase().replace(/[\s_-]+/g, "");
        if (!normalizedRawKeys.has(cleanK)) {
          normalizedRawKeys.set(cleanK, v);
        }
      }
    }
  }

  const getVal = (targetField: string, fallbacks: string[] = []): any => {
    if (
      mapping &&
      mapping[targetField] &&
      raw &&
      raw[mapping[targetField]] !== undefined &&
      raw[mapping[targetField]] !== null
    ) {
      return raw[mapping[targetField]];
    }
    if (raw && raw[targetField] !== undefined && raw[targetField] !== null) return raw[targetField];
    for (const fb of fallbacks) {
      if (raw && raw[fb] !== undefined && raw[fb] !== null) return raw[fb];
    }
    // Case-insensitive normalized search
    const cleanTarget = targetField.toLowerCase().replace(/[\s_-]+/g, "");
    if (normalizedRawKeys.has(cleanTarget)) {
      return normalizedRawKeys.get(cleanTarget);
    }
    for (const fb of fallbacks) {
      const cleanFb = fb.toLowerCase().replace(/[\s_-]+/g, "");
      if (normalizedRawKeys.has(cleanFb)) {
        return normalizedRawKeys.get(cleanFb);
      }
    }
    return undefined;
  };

  const rawProfileId = getVal("profileId", [
    "employeeId",
    "employee_id",
    "emp_id",
    "empCode",
    "employeeCode",
    "employee_code",
    "clockNumber",
    "clock_number",
    "code",
    "id",
    "كود_الموظف",
    "كود الموظف",
    "رقم_الملف",
  ]);
  const profileId = rawProfileId ? String(rawProfileId).trim() : "";

  let firstName = getVal("firstName", ["first_name", "first", "firstNameEn", "first_name_en"]) ?? "";
  let lastName = getVal("lastName", ["last_name", "last", "lastNameEn", "last_name_en", "second_name", "secondName", "second"]) ?? "";
  let thirdName =
    getVal("thirdName", ["third_name", "father_name", "middle_name", "thirdNameEn", "third"]) ?? "";
  let fourthName =
    getVal("fourthName", ["fourth_name", "family_name", "grand_father", "fourthNameEn", "fourth"]) ?? "";

  let firstNameAr = getVal("firstNameAr", ["first_name_ar", "firstName_ar", "الاسم_الأول", "الاسم الاول", "الاسم"]) ?? "";
  let lastNameAr = getVal("lastNameAr", ["last_name_ar", "lastName_ar", "الاسم_الثاني", "الاسم الثاني", "اسم_الأب", "اسم الاب"]) ?? "";
  let thirdNameAr = getVal("thirdNameAr", ["third_name_ar", "thirdName_ar", "الاسم_الثالث", "الاسم الثالث", "اسم_الجد", "اسم الجد"]) ?? "";
  let fourthNameAr = getVal("fourthNameAr", ["fourth_name_ar", "fourthName_ar", "الاسم_الرابع", "الاسم الرابع", "اسم_العائلة", "اسم العائلة", "اللقب"]) ?? "";

  // If full Arabic name provided without separate parts
  const rawFullNameAr = getVal("Arabic_Name", ["fullNameAr", "full_name_ar", "arabicName", "arabic_name", "الاسم_بالكامل", "الاسم بالكامل", "الاسم الرباعي"]);
  if (rawFullNameAr && (!firstNameAr || !lastNameAr)) {
    const arParts = splitCompoundName(String(rawFullNameAr), true);
    if (!firstNameAr) firstNameAr = arParts.first;
    if (!lastNameAr) lastNameAr = arParts.second;
    if (!thirdNameAr) thirdNameAr = arParts.third;
    if (!fourthNameAr) fourthNameAr = arParts.fourth;
  }

  // If full English name provided without separate parts
  const rawFullNameEn = getVal("Name", ["fullName", "full_name", "fullNameEn", "name", "employeeName", "emp_name"]);
  if (rawFullNameEn && (!firstName || !lastName)) {
    const enParts = splitCompoundName(String(rawFullNameEn), false);
    if (!firstName) firstName = enParts.first;
    if (!lastName) lastName = enParts.second;
    if (!thirdName) thirdName = enParts.third;
    if (!fourthName) fourthName = enParts.fourth;
  }

  const nationalId =
    getVal("nationalId", [
      "NationalId",
      "NationalID",
      "national_id",
      "nationalId",
      "nationalID",
      "id_number",
      "idNumber",
      "IdNumber",
      "IDNumber",
      "identity_number",
      "identityNumber",
      "IdentityNumber",
      "civil_id",
      "CivilId",
      "CivilID",
      "iqama",
      "ssn",
      "nid",
      "Nid",
      "NID",
      "الرقم_القومي",
      "الرقم القومي",
      "رقم_البطاقة",
      "رقم البطاقة",
      "بطاقة_الرقم_القومي",
      "بطاقة الرقم القومي",
      "رقم_الهوية",
      "رقم الهوية",
      "الهوية",
    ]) ?? "";
  const nationality = getVal("nationality", ["country", "الجنسية"]) ?? "";
  const address = getVal("address", ["street", "residence", "العنوان"]) ?? "";

  const jobTitle =
    getVal("jobTitle", [
      "position_name",
      "PositionName",
      "job_title",
      "JobTitle",
      "position",
      "Position",
      "title",
      "role",
      "job_title_en",
      "jobTitleEn",
      "jobTitle_en",
      "position_en",
      "positionEn",
      "PositionCode",
      "position_code",
    ]) ?? "";
  const jobTitleAr =
    getVal("jobTitleAr", [
      "ar_position_name",
      "ArabicPositionName",
      "position_name_ar",
      "job_title_ar",
      "jobTitle_ar",
      "jobTitleAr",
      "position_ar",
      "PositionAr",
      "ar_position",
      "title_ar",
      "titleAr",
      "الوظيفة",
      "المسمى_الوظيفي",
      "المسمى الوظيفي",
      "الوظيفه",
      "المهنة",
    ]) ?? "";

  const level =
    getVal("level", [
      "LevelCode",
      "level_code",
      "Level",
      "grade",
      "Grade",
      "job_level",
      "jobLevel",
      "JobLevel",
      "level_name",
      "LevelName",
      "الدرجة",
      "المستوى",
    ]) ?? "";
  const phone =
    getVal("phone", ["mobile", "telephone", "phone_number", "phoneNumber", "Mobile", "الهاتف", "الجوال", "الموبايل"]) ??
    "";

  const department =
    getVal("department", [
      "department_name",
      "DepartmentName",
      "dept",
      "section",
      "section_name",
      "SectionName",
      "department_en",
      "departmentEn",
      "dept_en",
      "deptEn",
      "section_en",
      "DepartmentCode",
      "department_code",
    ]) ?? "";
  const departmentAr = getVal("departmentAr", [
    "ar_department_name",
    "ArabicDepartmentName",
    "ar_section_name",
    "department_ar",
    "departmentAr",
    "DepartmentAr",
    "dept_ar",
    "deptAr",
    "section_ar",
    "sectionAr",
    "section_name_ar",
    "القسم",
    "الإدارة",
    "الادارة",
    "القسم_بالعربية",
    "الاداره",
  ]) ?? "";

  const hireDate =
    getVal("hireDate", ["hire_date", "joining_date", "hired_at", "تاريخ_التعيين"]) ??
    new Date().toISOString().split("T")[0];
  const dateOfBirth =
    getVal("dateOfBirth", ["date_of_birth", "birth_date", "dob", "تاريخ_الميلاد"]) ?? "";
  const email = getVal("email", ["mail", "email_address"]) ?? "";
  const emergencyContact =
    getVal("emergencyContact", [
      "emergency_contact",
      "emergency_phone",
      "emergencyPhone",
    ]) ?? "";
  const contractEndDate =
    getVal("contractEndDate", [
      "contract_end_date",
      "contractEnd",
      "contract_expiry",
    ]) ?? null;
  const employmentType =
    getVal("employmentType", ["employment_type", "type"]) ?? "INTERNAL";
  const companyName =
    getVal("companyName", [
      "company_name",
      "company",
      "hotelName",
      "hotel_name",
      "hotel",
      "hotelCode",
      "workplace",
      "worksAt",
      "vendor",
      "contractor",
    ]) ?? "";
  const photoUrl =
    getVal("photoUrl", ["photo_url", "photo", "avatar", "image"]) ?? null;
  const idImage =
    getVal("idImage", ["id_image", "national_id_image", "iqama_image"]) ??
    null;

  // Gender normalization
  const rawGender = String(
    getVal("gender", ["sex"]) ?? "M",
  ).trim().toUpperCase();
  const gender =
    rawGender.startsWith("F") || rawGender === "أنثى" || rawGender === "FEMALE"
      ? "F"
      : "M";

  // Vacation fields
  const vacationStartDate =
    getVal("vacationStartDate", [
      "vacation_start_date",
      "leave_start",
      "leaveStartDate",
    ]) ?? null;
  const vacationEndDate =
    getVal("vacationEndDate", [
      "vacation_end_date",
      "leave_end",
      "leaveEndDate",
    ]) ?? null;
  const vacationNotes =
    getVal("vacationNotes", ["vacation_notes", "leave_reason", "leaveNotes"]) ??
    "";

  // Status normalization
  const rawStatus = getVal("status", ["employee_status", "emp_status", "state"]);
  let normalizedStatus = normalizeHrStatus(rawStatus);

  // If vacation dates are provided and status is active, check if currently on vacation
  if (vacationStartDate && vacationEndDate && normalizedStatus === "ACTIVE") {
    const today = new Date().toISOString().split("T")[0];
    if (vacationStartDate <= today && vacationEndDate >= today) {
      normalizedStatus = "VACATION";
    }
  }

  // Documents / Attachments from HR
  const rawDocs = getVal("documents", ["idDocuments", "attachments", "files", "docs"]) || [];
  const documents: Array<{ fileName: string; fileType: string; fileData: string }> = [];
  if (Array.isArray(rawDocs)) {
    for (const d of rawDocs) {
      if (d && (d.fileName || d.name) && (d.fileData || d.data || d.url)) {
        documents.push({
          fileName: String(d.fileName || d.name || "document").trim(),
          fileType: String(d.fileType || d.type || "application/pdf").trim(),
          fileData: String(d.fileData || d.data || d.url).trim(),
        });
      }
    }
  }
  const passportDoc = getVal("passportImage", ["passport_image", "passport", "passportDoc"]);
  if (passportDoc && typeof passportDoc === "string" && passportDoc.trim()) {
    documents.push({
      fileName: "Passport Copy",
      fileType: "image/jpeg",
      fileData: passportDoc.trim(),
    });
  }
  const contractDoc = getVal("contractDocument", ["contract_doc", "contract_file", "contractFile", "contract_pdf"]);
  if (contractDoc && typeof contractDoc === "string" && contractDoc.trim()) {
    documents.push({
      fileName: "Employment Contract",
      fileType: "application/pdf",
      fileData: contractDoc.trim(),
    });
  }

  return {
    profileId,
    firstName: String(firstName).trim(),
    lastName: String(lastName).trim(),
    thirdName: String(thirdName).trim(),
    fourthName: String(fourthName).trim(),
    firstNameAr: String(firstNameAr).trim(),
    lastNameAr: String(lastNameAr).trim(),
    thirdNameAr: String(thirdNameAr).trim(),
    fourthNameAr: String(fourthNameAr).trim(),
    nationalId: String(nationalId).trim(),
    nationality: String(nationality).trim(),
    address: String(address).trim(),
    jobTitle: String(jobTitle).trim(),
    jobTitleAr: String(jobTitleAr).trim(),
    level: String(level).trim(),
    phone: String(phone).trim(),
    department: String(department).trim(),
    departmentAr: String(departmentAr).trim(),
    hireDate: String(hireDate).trim(),
    dateOfBirth: String(dateOfBirth).trim(),
    email: String(email).trim(),
    emergencyContact: String(emergencyContact).trim(),
    contractEndDate: contractEndDate ? String(contractEndDate).trim() : null,
    employmentType:
      String(employmentType).trim().toUpperCase() === "EXTERNAL"
        ? "EXTERNAL"
        : "INTERNAL",
    companyName: String(companyName).trim(),
    photoUrl: photoUrl ? String(photoUrl).trim() : null,
    idImage: idImage ? String(idImage).trim() : null,
    vacationStartDate: vacationStartDate
      ? String(vacationStartDate).trim()
      : null,
    vacationEndDate: vacationEndDate ? String(vacationEndDate).trim() : null,
    vacationNotes: vacationNotes ? String(vacationNotes).trim() : "",
    status: normalizedStatus,
    documents,
  };
}
