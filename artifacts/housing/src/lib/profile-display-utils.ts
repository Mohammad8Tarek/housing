/**
 * Universal Profile Display Utilities
 * Provides seamless bilingual display (Arabic <-> English) across all tables,
 * cards, modals, and report exports in Sunrise Staff Housing.
 */

import {
  transliterateFullName,
  hasArabicCharacters,
  hasEnglishCharacters,
} from "./bilingual-name-engine";
import {
  translateDepartment,
  translateJobTitle,
} from "./bilingual-hospitality-dict";

/**
 * Returns the formatted full name of an employee/profile based on current language
 */
export function getProfileDisplayName(profile: any, ar: boolean): string {
  if (!profile) return "—";

  const firstName = profile.firstName || profile.first_name || "";
  const lastName = profile.lastName || profile.last_name || "";
  const thirdName = profile.thirdName || profile.third_name || "";
  const fourthName = profile.fourthName || profile.fourth_name || "";

  const firstNameAr = profile.firstNameAr || profile.first_name_ar || "";
  const lastNameAr = profile.lastNameAr || profile.last_name_ar || "";
  const thirdNameAr = profile.thirdNameAr || profile.third_name_ar || "";
  const fourthNameAr = profile.fourthNameAr || profile.fourth_name_ar || "";

  const rawFullName = String(profile.fullName || profile.full_name || profile.name || "").trim();
  const rawFullNameAr = String(profile.fullNameAr || profile.full_name_ar || profile.nameAr || profile.name_ar || "").trim();

  if (ar) {
    // 1. Primary: Arabic fields (الاسم الأول + الثاني + الثالث + الرابع)
    const arTokens = [firstNameAr, lastNameAr, thirdNameAr, fourthNameAr].filter(Boolean);
    if (arTokens.length > 0) {
      return arTokens.join(" ").trim();
    }

    if (rawFullNameAr && hasArabicCharacters(rawFullNameAr)) {
      return rawFullNameAr;
    }

    // 2. Fallback: Check if default name is already Arabic
    const defaultTokens = [firstName, lastName, thirdName, fourthName].filter(Boolean);
    const defaultJoined = defaultTokens.join(" ").trim();
    if (defaultJoined && hasArabicCharacters(defaultJoined)) {
      return defaultJoined;
    }

    if (rawFullName && hasArabicCharacters(rawFullName)) {
      return rawFullName;
    }

    // 3. Fallback: Transliterate English name to Arabic
    if (defaultJoined) {
      return transliterateFullName(defaultJoined, "ar");
    }
    if (rawFullName) {
      return transliterateFullName(rawFullName, "ar");
    }

    return "—";
  } else {
    // 1. Primary: English default fields (First + Second + Third + Fourth)
    const enTokens = [firstName, lastName, thirdName, fourthName].filter(Boolean);
    const enJoined = enTokens.join(" ").trim();

    if (enJoined && hasEnglishCharacters(enJoined)) {
      return enJoined;
    }

    if (rawFullName && hasEnglishCharacters(rawFullName)) {
      return rawFullName;
    }

    // 2. Fallback: If English has Arabic characters or is empty, check Arabic fields and transliterate to English
    const arTokens = [firstNameAr, lastNameAr, thirdNameAr, fourthNameAr].filter(Boolean);
    const arCandidate = arTokens.length > 0 ? arTokens.join(" ").trim() : (rawFullNameAr || defaultJoined || rawFullName);

    if (arCandidate) {
      return transliterateFullName(arCandidate, "en");
    }

    return "—";
  }
}

/**
 * Returns the formatted job title based on current language
 */
export function getProfileDisplayJobTitle(profile: any, ar: boolean): string {
  if (!profile) return "—";
  const title = String(profile.jobTitle || profile.job_title || profile.title || "").trim();
  const titleAr = String(profile.jobTitleAr || profile.job_title_ar || profile.titleAr || profile.title_ar || "").trim();

  if (ar) {
    if (titleAr) return titleAr;
    if (title && hasArabicCharacters(title)) return title;
    return translateJobTitle(title, "ar") || title || "—";
  } else {
    if (title && hasEnglishCharacters(title)) return title;
    if (titleAr) return translateJobTitle(titleAr, "en") || titleAr;
    return translateJobTitle(title, "en") || title || "—";
  }
}

/**
 * Returns the formatted department based on current language
 */
export function getProfileDisplayDepartment(profile: any, ar: boolean): string {
  if (!profile) return "—";
  const dept = String(profile.department || profile.dept || "").trim();
  const deptAr = String(profile.departmentAr || profile.department_ar || profile.deptAr || profile.dept_ar || "").trim();

  if (ar) {
    if (deptAr) return deptAr;
    if (dept && hasArabicCharacters(dept)) return dept;
    return translateDepartment(dept, "ar") || dept || "—";
  } else {
    if (dept && hasEnglishCharacters(dept)) return dept;
    if (deptAr) return translateDepartment(deptAr, "en") || deptAr;
    return translateDepartment(dept, "en") || dept || "—";
  }
}
