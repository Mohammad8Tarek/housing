// Report row builders — policy exceptions. Split out of useReportDataProcessor; logic unchanged.
import { formatDate } from "../date-utils";
import {
  getProfileDisplayName,
  getProfileDisplayDepartment,
} from "../profile-display-utils";
import type { ReportProcessorContext } from "./context";
import { comparableDate } from "./context";

// POLICY EXCEPTIONS & LEVEL AUDIT REPORT (تقرير استثناءات ومخالفات السياسة والدرجات الوظيفية)
export function processPolicyExceptions(ctx: ReportProcessorContext): any[] {
  const {
    ar,
    filterBuilding,
    filterFloor,
    filterStatus,
    filterCategory,
    filterDepartment,
    assignments,
    hostings,
    buildingMap,
    roomMap,
    empMap,
    settings,
    filteredBuildingIds,
    filteredFloorIds,
    applySearchAndDate,
  } = ctx;
  const exceptions: any[] = [];
  const policySettings = settings || {};

  const l0Cap = Number(policySettings?.policyLevel0Capacity) || 1;
  const l1Cap = Number(policySettings?.policyLevel1Capacity) || 1;
  const l2Cap = Number(policySettings?.policyLevel2Capacity) || 2;
  const l3Cap = Number(policySettings?.policyLevel3Capacity) || 3;
  const l4Cap = Number(policySettings?.policyLevel4Capacity) || 4;
  const l5Cap = Number(policySettings?.policyLevel5Capacity) || 5;
  const l6Cap = Number(policySettings?.policyLevel6Capacity) || 6;
  const customRules: any[] = Array.isArray(policySettings?.customLevelRules)
    ? policySettings.customLevelRules
    : [];
  const jobPolicies: any[] = Array.isArray(policySettings?.jobLevelPolicies)
    ? policySettings.jobLevelPolicies
    : [];
  const clusterEnabled = policySettings?.policyDepartmentClustering ?? true;
  const strictSegregation =
    policySettings?.policyStrictDepartmentSegregation ?? false;

  // Group active assignments by room
  const activeByRoom = new Map<number, any[]>();
  for (const a of assignments) {
    if (a.status === "ACTIVE" || a.status === "VACATION") {
      const list = activeByRoom.get(a.roomId) || [];
      list.push(a);
      activeByRoom.set(a.roomId, list);
    }
  }

  const todayStr = new Date().toISOString().split("T")[0];

  // 1. Audit active and historical occupants for violations & resolutions
  for (const a of assignments) {
    const room = roomMap[a.roomId];
    const emp = empMap[a.profileId];
    if (!emp || !room) continue;

    if (filterBuilding !== "all" && !filteredBuildingIds.has(room.buildingId))
      continue;
    if (filterFloor !== "all" && !filteredFloorIds.has(room.floorId)) continue;
    if (filterDepartment !== "all" && emp.department !== filterDepartment)
      continue;

    const isActive = a.status === "ACTIVE" || a.status === "VACATION";
    const isTransferred = a.status === "TRANSFERRED";
    const isCheckedOut =
      a.status === "CHECKED_OUT" || a.status === "LEFT" || a.status === "ENDED";
    const isExplicitResolved = Boolean(
      a.notes?.includes("[تم التصحيح]") ||
      a.notes?.includes("[RESOLVED]") ||
      (a as any).isResolved,
    );

    // An assignment is resolved if it was closed/transferred/checked-out, or explicitly marked resolved
    const isResolved = !isActive || isExplicitResolved;
    const resolvedAt = !isActive
      ? a.transferDate ||
        a.checkOutDate ||
        a.actualCheckOutDate ||
        (a as any).updatedAt ||
        ""
      : isExplicitResolved
        ? (a as any).updatedAt || ""
        : "";

    const resolutionDetails = !isActive
      ? isTransferred
        ? ar
          ? "تم تصحيح ومعالجة المخالفة بنقل المقيم لغرفة/سرير آخر مطابق للسياسة"
          : "Resolved: Resident transferred to compliant room/bed"
        : ar
          ? "تم تصحيح ومعالجة المخالفة بإنهاء الإقامة وتسجيل مغادرة المقيم من السكن"
          : "Resolved: Resident checked out from housing"
      : isExplicitResolved
        ? ar
          ? "تم تصحيح المخالفة واعتماد توفيق الأوضاع"
          : "Resolved: Corrected and compliant"
        : "";

    const isApprovedException =
      !isResolved &&
      Boolean(
        (a as any).hasPolicyException ||
        (a.notes &&
          (a.notes.includes("استثناء") || a.notes.includes("override"))),
      );

    const exceptionApprover =
      (a as any).policyApprovedBy ||
      a.notes?.match(/المعتمد:\s*([^\]|]+)/)?.[1]?.trim() ||
      (isApprovedException ? (ar ? "إدارة السكن" : "Housing Admin") : "—");

    const exceptionReasonText =
      (a as any).policyExceptionReason ||
      a.notes ||
      (ar ? "لا يوجد تصريح مسجل" : "No override noted");

    const approvalStatusText = isResolved
      ? ar
        ? "✓ تم تصحيحها ومعالجتها"
        : "✓ Corrected & Resolved"
      : isApprovedException
        ? ar
          ? "معتمد رسمياً (استثناء مصرح)"
          : "Approved (Authorized)"
        : ar
          ? "مخالفة قائمة (غير مصححة)"
          : "Active Violation (Unresolved)";

    const bName = buildingMap[room.buildingId] || "—";
    const roomCap = room.capacity || 1;
    const roomOcc = isActive ? activeByRoom.get(room.id)?.length || 1 : roomCap;
    const lvl = String(emp.level || "")
      .trim()
      .toLowerCase();
    const profileDept = (emp.department || "").trim().toLowerCase();

    let maxAllowedCap = l4Cap;
    let allowedCapacities: number[] | null = null;
    let allowEntireConfigured: boolean | null = null;
    let levelCategory = ar
      ? "الدرجة الرابعة (عمال/خدمات)"
      : "Level 4 (General Staff)";

    const matchedJob =
      jobPolicies.length > 0
        ? jobPolicies.find((jp: any) => {
            const key = String(jp.levelKey ?? "")
              .trim()
              .toLowerCase();
            const name = String(jp.name ?? "")
              .trim()
              .toLowerCase();
            const nameAr = String(jp.nameAr ?? "")
              .trim()
              .toLowerCase();
            const id = String(jp.id ?? "")
              .trim()
              .toLowerCase();

            if (
              key &&
              (lvl === key || lvl === `level ${key}` || lvl === `level_${key}`)
            )
              return true;
            if (id && (lvl === id || lvl === `level_${id}`)) return true;
            if (
              name &&
              (lvl === name || lvl.includes(name) || name.includes(lvl))
            )
              return true;
            if (
              nameAr &&
              (lvl === nameAr || lvl.includes(nameAr) || nameAr.includes(lvl))
            )
              return true;

            if (
              key === "0" &&
              (lvl === "vip" ||
                lvl.includes("قيادات") ||
                lvl.includes("عليا") ||
                lvl.includes("إدارة عليا") ||
                lvl.includes("chief") ||
                lvl.includes("director") ||
                lvl.includes("gm"))
            )
              return true;
            if (
              key === "1" &&
              (lvl.includes("مدير إدارة") ||
                lvl.includes("مدير قسم") ||
                lvl.includes("مدير فندق") ||
                lvl.includes("head") ||
                lvl.includes("hod"))
            )
              return true;
            if (
              key === "2" &&
              (lvl.includes("إشراف") ||
                lvl.includes("مشرف") ||
                lvl.includes("supervisor") ||
                lvl.includes("نائب"))
            )
              return true;
            if (
              key === "3" &&
              (lvl.includes("فني") ||
                lvl.includes("technician") ||
                lvl.includes("senior") ||
                lvl.includes("officer") ||
                lvl.includes("موظف"))
            )
              return true;
            if (
              key === "4" &&
              (lvl.includes("عامل") ||
                lvl.includes("worker") ||
                lvl.includes("سائق") ||
                lvl.includes("خدمات"))
            )
              return true;
            return false;
          })
        : null;

    if (matchedJob) {
      allowedCapacities =
        Array.isArray(matchedJob.allowedCapacities) &&
        matchedJob.allowedCapacities.length > 0
          ? matchedJob.allowedCapacities
              .map(Number)
              .filter((n: number) => !isNaN(n) && n > 0)
          : [1];
      maxAllowedCap = Math.max(...(allowedCapacities ?? [1]));
      allowEntireConfigured = Boolean(matchedJob.allowEntire);
      levelCategory = ar
        ? matchedJob.nameAr || matchedJob.name
        : matchedJob.name || matchedJob.nameAr;
    } else {
      const matchedCustom = customRules.find((cr: any) => {
        const crName = String(cr.name || "")
          .trim()
          .toLowerCase();
        const crNameAr = String(cr.nameAr || "")
          .trim()
          .toLowerCase();
        return (
          (crName && lvl === crName) ||
          (crNameAr && lvl === crNameAr) ||
          (crName && lvl.includes(crName))
        );
      });

      if (matchedCustom) {
        maxAllowedCap = Number(matchedCustom.capacity) || 4;
        allowedCapacities = [maxAllowedCap];
        allowEntireConfigured = Boolean(matchedCustom.allowEntire);
        levelCategory = ar
          ? matchedCustom.nameAr || matchedCustom.name
          : matchedCustom.name || matchedCustom.nameAr;
      } else if (
        lvl === "0" ||
        lvl === "level 0" ||
        lvl === "vip" ||
        lvl.includes("قيادات") ||
        lvl.includes("عليا") ||
        lvl.includes("إدارة عليا") ||
        lvl.includes("chief") ||
        lvl.includes("controller") ||
        lvl.includes("gm") ||
        lvl.includes("director")
      ) {
        maxAllowedCap = l0Cap;
        allowedCapacities = [l0Cap];
        allowEntireConfigured = policySettings?.policyLevel0AllowEntire ?? true;
        levelCategory = ar
          ? "الدرجة صفر (إدارة عليا / قيادات)"
          : "Level 0 (Top Executive / VIP)";
      } else if (
        lvl === "1" ||
        lvl === "level 1" ||
        lvl.includes("مدير قسم") ||
        lvl.includes("مدير إدارة") ||
        lvl.includes("head") ||
        lvl.includes("hod")
      ) {
        maxAllowedCap = l1Cap;
        allowedCapacities = [l1Cap];
        allowEntireConfigured = policySettings?.policyLevel1AllowEntire ?? true;
        levelCategory = ar
          ? "الدرجة الأولى (مدراء أقسام)"
          : "Level 1 (Department Heads)";
      } else if (
        lvl === "2" ||
        lvl === "level 2" ||
        lvl.includes("مشرف") ||
        lvl.includes("supervisor") ||
        lvl.includes("manager")
      ) {
        maxAllowedCap = l2Cap;
        allowedCapacities = [l2Cap];
        allowEntireConfigured =
          policySettings?.policyLevel2AllowEntire ?? false;
        levelCategory = ar
          ? "الدرجة الثانية (إشرافي/مساعدين)"
          : "Level 2 (Supervisory)";
      } else if (
        lvl === "3" ||
        lvl === "level 3" ||
        lvl.includes("فني") ||
        lvl.includes("specialist") ||
        lvl.includes("senior")
      ) {
        maxAllowedCap = l3Cap;
        allowedCapacities = [l3Cap];
        allowEntireConfigured = false;
        levelCategory = ar
          ? "الدرجة الثالثة (فني/تخصصي)"
          : "Level 3 (Senior/Staff)";
      } else if (
        lvl === "5" ||
        lvl === "level 5" ||
        lvl.includes("خامس") ||
        lvl.includes("level 5") ||
        lvl.includes("5")
      ) {
        maxAllowedCap = l5Cap;
        allowedCapacities = [l5Cap];
        allowEntireConfigured =
          policySettings?.policyLevel5AllowEntire ?? false;
        levelCategory = ar
          ? "الدرجة الخامسة (عمال معاونون)"
          : "Level 5 (Support Staff)";
      } else if (
        lvl === "6" ||
        lvl === "level 6" ||
        lvl.includes("سادس") ||
        lvl.includes("level 6") ||
        lvl.includes("6")
      ) {
        maxAllowedCap = l6Cap;
        allowedCapacities = [l6Cap];
        allowEntireConfigured =
          policySettings?.policyLevel6AllowEntire ?? false;
        levelCategory = ar
          ? "الدرجة السادسة (تسكين مكثف)"
          : "Level 6 (Intensive Shared)";
      } else {
        allowedCapacities = [l4Cap];
        allowEntireConfigured = false;
      }
    }

    const itemDate =
      a.startDate ||
      a.createdAt ||
      (a as any).policyExceptionDate ||
      (a as any).updatedAt ||
      "";

    // Check A: Capacity Exceeded or Mismatched
    const isCapViolated =
      allowedCapacities && allowedCapacities.length > 0
        ? !allowedCapacities.includes(roomCap)
        : roomCap > maxAllowedCap;

    if (isCapViolated) {
      exceptions.push({
        id: `cap_${a.id}`,
        categoryKey: "capacity",
        requestDate: itemDate,
        profileName: getProfileDisplayName(emp, ar) || "—",
        profileCode: emp.profileId || emp.code || "—",
        nationalId: emp.nationalId || "—",
        jobLevel: emp.level || levelCategory,
        department: getProfileDisplayDepartment(emp, ar) || "—",
        roomNumber: room.roomNumber || "—",
        buildingName: bName,
        roomCapacity: roomCap,
        currentOccupancy: roomOcc,
        violationType: ar
          ? "تجاوز سعة الدرجة الوظيفية"
          : "Level Capacity Exceeded",
        violationDetails: ar
          ? `المقيم من ${levelCategory} ومسكن بغرفة سعتها (${roomCap} أفراد) والسعات المعتمدة للسياسة (${(allowedCapacities || [maxAllowedCap]).join(" أو ")} سرير)`
          : `Resident is ${levelCategory} in a room of ${roomCap} beds (policy allowed: ${(allowedCapacities || [maxAllowedCap]).join(", ")})`,
        severity: ar ? "مرتفعة" : "High",
        isResolved,
        isApproved: isApprovedException,
        resolvedAt,
        resolutionDetails,
        approvalStatus: approvalStatusText,
        approvedBy: exceptionApprover,
        overrideReason: exceptionReasonText,
      });
    }

    // Check B: Department Segregation / Mixing (for active room sharing)
    const roommates = isActive
      ? (activeByRoom.get(room.id) || [])
          .filter((x: any) => x.id !== a.id)
          .map((x: any) => empMap[x.profileId])
          .filter(Boolean)
      : [];

    if (isActive && profileDept && roommates.length > 0) {
      const diffDeptRoommates = roommates.filter(
        (rm: any) =>
          (rm.department || "").trim().toLowerCase() !== profileDept &&
          (rm.department || "").trim() !== "",
      );
      if (
        (strictSegregation || clusterEnabled) &&
        diffDeptRoommates.length > 0
      ) {
        exceptions.push({
          id: `dept_${a.id}`,
          categoryKey: "department",
          requestDate: itemDate,
          profileName: getProfileDisplayName(emp, ar) || "—",
          profileCode: emp.profileId || emp.code || "—",
          nationalId: emp.nationalId || "—",
          jobLevel: emp.level || levelCategory,
          department: getProfileDisplayDepartment(emp, ar) || "—",
          roomNumber: room.roomNumber || "—",
          buildingName: bName,
          roomCapacity: roomCap,
          currentOccupancy: roomOcc,
          violationType: strictSegregation
            ? ar
              ? "مخالفة صارمة لفصل الأقسام"
              : "Strict Department Mixing Violation"
            : ar
              ? "خلط أقسام مختلفة بالغرفة"
              : "Cross-Department Clustering Exception",
          violationDetails: ar
            ? `الغرفة تضم أقساماً مختلفة: قسم (${emp.department}) مع قسم (${diffDeptRoommates.map((d: any) => d.department).join(", ")})`
            : `Room contains mixed departments: (${emp.department}) with (${diffDeptRoommates.map((d: any) => d.department).join(", ")})`,
          severity: strictSegregation
            ? ar
              ? "حرجة"
              : "Critical"
            : ar
              ? "متوسطة"
              : "Medium",
          isResolved,
          isApproved: isApprovedException,
          resolvedAt,
          resolutionDetails,
          approvalStatus: approvalStatusText,
          approvedBy: exceptionApprover,
          overrideReason: exceptionReasonText,
        });
      }
    }

    // Check C: Unauthorized Entire Room Booking
    if (a.isEntireRoom && roomCap > 1) {
      const isL0 =
        lvl === "0" ||
        lvl === "level 0" ||
        lvl === "vip" ||
        lvl.includes("قيادات") ||
        lvl.includes("عليا") ||
        lvl.includes("إدارة عليا") ||
        lvl.includes("chief") ||
        lvl.includes("controller") ||
        lvl.includes("gm") ||
        lvl.includes("director");
      const isL1 =
        !isL0 && (lvl === "1" || lvl === "level 1" || lvl.includes("مدير"));
      const isL2 =
        !isL0 &&
        !isL1 &&
        (lvl === "2" ||
          lvl === "level 2" ||
          lvl.includes("مشرف") ||
          lvl.includes("supervisor"));
      const allowEntire =
        allowEntireConfigured != null
          ? allowEntireConfigured
          : isL0
            ? (policySettings?.policyLevel0AllowEntire ?? true)
            : isL1
              ? (policySettings?.policyLevel1AllowEntire ?? true)
              : isL2
                ? (policySettings?.policyLevel2AllowEntire ?? false)
                : false;
      if (!allowEntire) {
        exceptions.push({
          id: `entire_${a.id}`,
          categoryKey: "entire_room",
          requestDate: itemDate,
          profileName: getProfileDisplayName(emp, ar) || "—",
          profileCode: emp.profileId || emp.code || "—",
          nationalId: emp.nationalId || "—",
          jobLevel: emp.level || levelCategory,
          department: getProfileDisplayDepartment(emp, ar) || "—",
          roomNumber: room.roomNumber || "—",
          buildingName: bName,
          roomCapacity: roomCap,
          currentOccupancy: roomOcc,
          violationType: ar
            ? "حجز غرفة كاملة غير مصرح"
            : "Unauthorized Entire Room",
          violationDetails: ar
            ? `حجز غرفة متعددة الأسرة (${roomCap} سرير) بالكامل لشخص واحد غير مصرح له في السياسة`
            : `Entire multi-bed room (${roomCap} beds) reserved by a single occupant not entitled in policy`,
          severity: ar ? "مرتفعة" : "High",
          isResolved,
          isApproved: isApprovedException,
          resolvedAt,
          resolutionDetails,
          approvalStatus: approvalStatusText,
          approvedBy: exceptionApprover,
          overrideReason: exceptionReasonText,
        });
      }
    }

    // Check D: Strict Gender Segregation Check
    const strictGender =
      policySettings?.policyStrictGenderSegregation !== false;
    const empGender = (emp.gender || "").trim().toLowerCase();
    const roomGender = (room.gender || "").trim().toLowerCase();
    if (strictGender && empGender) {
      let genderViolation = false;
      let genderDetails = "";
      if (
        roomGender &&
        roomGender !== "any" &&
        roomGender !== "all" &&
        roomGender !== empGender
      ) {
        genderViolation = true;
        genderDetails = ar
          ? `المقيم (${empGender === "female" ? "أنثى" : "ذكر"}) مسكن بغرفة مخصصة لـ (${roomGender === "female" ? "الإناث" : "الذكور"})`
          : `Resident (${empGender}) assigned to (${roomGender}) room`;
      }
      if (isActive) {
        const conflictingRoommates = roommates.filter((rm: any) => {
          const g = (rm.gender || "").trim().toLowerCase();
          return g && g !== empGender;
        });
        if (conflictingRoommates.length > 0) {
          genderViolation = true;
          genderDetails = ar
            ? `تسكين مشترك مختلط: تضم الغرفة ذكوراً وإناثاً (${conflictingRoommates.map((r: any) => r.firstName || r.name).join(", ")})`
            : `Mixed gender sharing: Room houses opposite genders`;
        }
      }

      if (genderViolation) {
        exceptions.push({
          id: `gender_${a.id}`,
          categoryKey: "gender",
          requestDate: itemDate,
          profileName: getProfileDisplayName(emp, ar) || "—",
          profileCode: emp.profileId || emp.code || "—",
          nationalId: emp.nationalId || "—",
          jobLevel: emp.level || levelCategory,
          department: getProfileDisplayDepartment(emp, ar) || "—",
          roomNumber: room.roomNumber || "—",
          buildingName: bName,
          roomCapacity: roomCap,
          currentOccupancy: roomOcc,
          violationType: ar
            ? "مخالفة فصل الجنسين الصارمة"
            : "Strict Gender Mixing Violation",
          violationDetails: genderDetails,
          severity: ar ? "حرجة" : "Critical",
          isResolved,
          isApproved: isApprovedException,
          resolvedAt,
          resolutionDetails,
          approvalStatus: approvalStatusText,
          approvedBy: exceptionApprover,
          overrideReason: exceptionReasonText,
        });
      }
    }

    // Check E: Strict Family Segregation Check
    const strictFamily =
      policySettings?.policyStrictFamilySegregation !== false;
    if (strictFamily) {
      const roomCls = (
        room.classification ||
        room.roomType ||
        ""
      ).toLowerCase();
      const isFamilyRoom =
        roomCls.includes("family") ||
        roomCls.includes("عائل") ||
        roomCls.includes("suite");
      const isFamilyEmp = Boolean(
        emp.isFamily === true ||
        (emp.guestType || "").toLowerCase() === "family" ||
        (emp.jobTitle || emp.title || "").toLowerCase().includes("عائل"),
      );

      if (!isFamilyEmp && isFamilyRoom && !a.isEntireRoom) {
        exceptions.push({
          id: `family_${a.id}`,
          categoryKey: "family",
          requestDate: itemDate,
          profileName: getProfileDisplayName(emp, ar) || "—",
          profileCode: emp.profileId || emp.code || "—",
          nationalId: emp.nationalId || "—",
          jobLevel: emp.level || levelCategory,
          department: getProfileDisplayDepartment(emp, ar) || "—",
          roomNumber: room.roomNumber || "—",
          buildingName: bName,
          roomCapacity: roomCap,
          currentOccupancy: roomOcc,
          violationType: ar
            ? "مخالفة سكن العائلات الصارمة"
            : "Strict Family Room Violation",
          violationDetails: ar
            ? "تسكين موظف فردي (أعزب) في جناح مخصص للعائلات بدون استثناء إداري مصرح"
            : "Single resident assigned to family suite without approved exception",
          severity: ar ? "مرتفعة" : "High",
          isResolved,
          isApproved: isApprovedException,
          resolvedAt,
          resolutionDetails,
          approvalStatus: approvalStatusText,
          approvedBy: exceptionApprover,
          overrideReason: exceptionReasonText,
        });
      }
    }

    // Check F: Contract Expiry Overstay Alert (انتهاء عقد العمل مع استمرار الإقامة)
    if (emp.contractEndDate) {
      const cEnd = comparableDate(emp.contractEndDate);
      if (cEnd) {
        if (isActive && cEnd < todayStr) {
          exceptions.push({
            id: `contract_${a.id}`,
            categoryKey: "contract",
            requestDate: itemDate,
            profileName: getProfileDisplayName(emp, ar) || "—",
            profileCode: emp.profileId || emp.code || "—",
            nationalId: emp.nationalId || "—",
            jobLevel: emp.level || levelCategory,
            department: getProfileDisplayDepartment(emp, ar) || "—",
            roomNumber: room.roomNumber || "—",
            buildingName: bName,
            roomCapacity: roomCap,
            currentOccupancy: roomOcc,
            violationType: ar
              ? "إقامة بعد انتهاء عقد العمل"
              : "Contract Expiry Overstay",
            violationDetails: ar
              ? `المقيم مستمر في السكن رغم انتهاء عقد العمل بتاريخ ${formatDate(emp.contractEndDate)} دون تجديد رسمي معتمد من الموارد البشرية`
              : `Resident continuing in housing after contract expired on ${formatDate(emp.contractEndDate)} without approved HR renewal`,
            severity: ar ? "مرتفعة" : "High",
            isResolved,
            isApproved: isApprovedException,
            resolvedAt,
            resolutionDetails,
            approvalStatus: approvalStatusText,
            approvedBy: exceptionApprover,
            overrideReason: exceptionReasonText,
          });
        } else if (!isActive && (a.actualCheckOutDate || a.checkOutDate)) {
          const outDate = comparableDate(
            a.actualCheckOutDate || a.checkOutDate,
          );
          if (outDate && outDate > cEnd) {
            exceptions.push({
              id: `contract_${a.id}`,
              categoryKey: "contract",
              requestDate: itemDate,
              profileName: getProfileDisplayName(emp, ar) || "—",
              profileCode: emp.profileId || emp.code || "—",
              nationalId: emp.nationalId || "—",
              jobLevel: emp.level || levelCategory,
              department: getProfileDisplayDepartment(emp, ar) || "—",
              roomNumber: room.roomNumber || "—",
              buildingName: bName,
              roomCapacity: roomCap,
              currentOccupancy: roomOcc,
              violationType: ar
                ? "إقامة بعد انتهاء عقد العمل (تمت معالجتها)"
                : "Contract Expiry Overstay (Resolved)",
              violationDetails: ar
                ? `أقام المقيم بالسكن بعد انتهاء عقده (${formatDate(emp.contractEndDate)}) وتمت معالجة المخالفة بإنهاء الإقامة والمغادرة بتاريخ ${formatDate(a.actualCheckOutDate || a.checkOutDate)}`
                : `Resident stayed past contract end date (${formatDate(emp.contractEndDate)}) and was resolved by checkout on ${formatDate(a.actualCheckOutDate || a.checkOutDate)}`,
              severity: ar ? "مرتفعة" : "High",
              isResolved: true,
              isApproved: false,
              resolvedAt: a.actualCheckOutDate || a.checkOutDate || a.updatedAt,
              resolutionDetails: ar
                ? "تم تصحيح ومعالجة المخالفة بإنهاء الإقامة وتسجيل المغادرة"
                : "Resolved by resident checkout",
              approvalStatus: ar
                ? "✓ تم تصحيحها ومعالجتها"
                : "✓ Corrected & Resolved",
              approvedBy: exceptionApprover,
              overrideReason: exceptionReasonText,
            });
          }
        }
      }
    }

    // Check G: Smoking Preference Conflict (تعارض سياسة التدخين)
    const empSmoker = Boolean(
      (emp as any).isSmoking === true ||
      String(emp.notes || "").includes("مدخن") ||
      String((emp as any).smokingPreference || "").toLowerCase() === "smoker",
    );
    const roomNonSmoking = Boolean(
      (room as any).isNonSmoking === true ||
      String(room.notes || "").includes("غير مدخن") ||
      String(room.notes || "")
        .toLowerCase()
        .includes("non-smoking"),
    );
    if (empSmoker && roomNonSmoking) {
      exceptions.push({
        id: `smoke_${a.id}`,
        categoryKey: "smoking",
        requestDate: itemDate,
        profileName: getProfileDisplayName(emp, ar) || "—",
        profileCode: emp.profileId || emp.code || "—",
        nationalId: emp.nationalId || "—",
        jobLevel: emp.level || levelCategory,
        department: getProfileDisplayDepartment(emp, ar) || "—",
        roomNumber: room.roomNumber || "—",
        buildingName: bName,
        roomCapacity: roomCap,
        currentOccupancy: roomOcc,
        violationType: ar ? "مخالفة سياسة التدخين" : "Smoking Policy Mismatch",
        violationDetails: ar
          ? `المقيم مسجل كمدخن في غرفة مخصصة لغير المدخنين`
          : `Resident is marked as smoker in a designated Non-Smoking room`,
        severity: ar ? "متوسطة" : "Medium",
        isResolved,
        isApproved: isApprovedException,
        resolvedAt,
        resolutionDetails,
        approvalStatus: approvalStatusText,
        approvedBy: exceptionApprover,
        overrideReason: exceptionReasonText,
      });
    }

    // Check H: Do Not Room Together / Mutual Exclusion (حظر الجمع بين نزلاء)
    if (isActive && roommates.length > 0) {
      const pNotes = String(emp.notes || "").toLowerCase();
      for (const rm of roommates) {
        const rmCode = String(rm.profileId || rm.code || "").toLowerCase();
        const rmNotes = String(rm.notes || "").toLowerCase();
        const myCode = String(emp.profileId || emp.code || "").toLowerCase();
        const isBlacklisted =
          (rmCode &&
            pNotes.includes("عدم التسكين مع") &&
            pNotes.includes(rmCode)) ||
          (myCode &&
            rmNotes.includes("عدم التسكين مع") &&
            rmNotes.includes(myCode));
        if (isBlacklisted) {
          exceptions.push({
            id: `dnr_${a.id}_${rm.id}`,
            categoryKey: "dnr",
            requestDate: itemDate,
            profileName: getProfileDisplayName(emp, ar) || "—",
            profileCode: emp.profileId || emp.code || "—",
            nationalId: emp.nationalId || "—",
            jobLevel: emp.level || levelCategory,
            department: getProfileDisplayDepartment(emp, ar) || "—",
            roomNumber: room.roomNumber || "—",
            buildingName: bName,
            roomCapacity: roomCap,
            currentOccupancy: roomOcc,
            violationType: ar
              ? "مخالفة عدم الجمع بين نزلاء"
              : "Do Not Room Together Violation",
            violationDetails: ar
              ? `توجد موانع إدارية أو خلافات سابقة تحظر تسكين المقيم مع (${rm.firstName || ""} ${rm.lastName || ""} #${rm.profileId || rm.code}) في نفس الغرفة`
              : `Administrative restrictions prohibit housing resident with (${rm.firstName || ""} ${rm.lastName || ""} #${rm.profileId || rm.code}) in the same room`,
            severity: ar ? "حرجة" : "Critical",
            isResolved,
            isApproved: isApprovedException,
            resolvedAt,
            resolutionDetails,
            approvalStatus: approvalStatusText,
            approvedBy: exceptionApprover,
            overrideReason: exceptionReasonText,
          });
        }
      }
    }
  }

  // 2. Audit Family Visits overstay
  const maxNights = Number(policySettings?.visitMaxNights) || 7;
  for (const h of hostings || []) {
    const isVisitActive = h.status === "ACTIVE" || h.status === "APPROVED";
    const isVisitCompleted =
      h.status === "COMPLETED" || h.status === "CHECKED_OUT";
    if (isVisitActive || isVisitCompleted) {
      const start = new Date(h.startDate || h.checkInDate || h.createdAt);
      const end =
        h.endDate || h.checkOutDate || h.actualCheckOutDate
          ? new Date(h.endDate || h.checkOutDate || h.actualCheckOutDate)
          : new Date();
      const days = Math.ceil(
        (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24),
      );
      if (days > maxNights) {
        const hostEmp = empMap[h.profileId];
        const isVisitResolved = isVisitCompleted;
        const visitResolvedAt = isVisitResolved
          ? h.actualCheckOutDate || h.checkOutDate || h.updatedAt || ""
          : "";
        const visitResolutionDetails = isVisitResolved
          ? ar
            ? "تم إنهاء الزيارة وتسجيل مغادرة الضيف رسمياً"
            : "Visit completed and guest checked out"
          : "";
        const visitApprovalStatus = isVisitResolved
          ? ar
            ? "✓ تم تصحيحها ومعالجتها"
            : "✓ Corrected & Resolved"
          : ar
            ? "معتمد (تجاوز مدة)"
            : "Approved (Overstay)";

        exceptions.push({
          id: `host_${h.id}`,
          categoryKey: "visit",
          requestDate: h.startDate || h.checkInDate || h.createdAt || "",
          profileName: h.guestName || (ar ? "ضيف عائلي" : "Family Guest"),
          profileCode: hostEmp?.profileId || `Host #${h.profileId}`,
          nationalId: h.nationalId || h.guestId || "—",
          jobLevel: ar ? "زيارة عائلية" : "Family Visit",
          department: hostEmp ? getProfileDisplayDepartment(hostEmp, ar) : "—",
          roomNumber:
            h.roomNumber ||
            (h.roomId ? roomMap[h.roomId]?.roomNumber : "—") ||
            "—",
          buildingName:
            h.roomId && roomMap[h.roomId]
              ? buildingMap[roomMap[h.roomId].buildingId] || "—"
              : "—",
          roomCapacity: 1,
          currentOccupancy: 1,
          violationType: ar
            ? "تجاوز الحد الأقصى لليالي الزيارة"
            : "Visit Duration Exceeded",
          violationDetails: ar
            ? `مدة الزيارة (${days} ليالٍ) تجاوزت الحد الأقصى المسموح (${maxNights} ليالٍ)`
            : `Visit length (${days} nights) exceeded max allowed (${maxNights} nights)`,
          severity: ar ? "مرتفعة" : "High",
          isResolved: isVisitResolved,
          isApproved: true,
          resolvedAt: visitResolvedAt,
          resolutionDetails: visitResolutionDetails,
          approvalStatus: visitApprovalStatus,
          approvedBy: h.approvedBy || "—",
          overrideReason:
            h.notes || (ar ? "طلب استضافة معتمد" : "Approved hosting request"),
        });
      }
    }
  }

  // 3. Filter by Category (Policy / Violation Type)
  let filteredExceptions = exceptions;
  if (filterCategory && filterCategory !== "all") {
    filteredExceptions = filteredExceptions.filter(
      (item) => item.categoryKey === filterCategory,
    );
  }

  // 4. Filter by Status (Approval Status, Resolution, or Severity / Risk Level)
  if (filterStatus && filterStatus !== "all") {
    filteredExceptions = filteredExceptions.filter((item) => {
      const fs = filterStatus.toUpperCase();
      if (fs === "OPEN") {
        return !item.isResolved && !item.isApproved;
      }
      if (fs === "RESOLVED") {
        return Boolean(item.isResolved);
      }
      if (fs === "APPROVED") {
        return Boolean(item.isApproved);
      }
      if (fs === "UNAPPROVED") {
        return !item.isApproved;
      }
      if (fs === "CRITICAL") {
        return item.severity === "حرجة" || item.severity === "Critical";
      }
      if (fs === "HIGH") {
        return item.severity === "مرتفعة" || item.severity === "High";
      }
      if (fs === "MEDIUM") {
        return item.severity === "متوسطة" || item.severity === "Medium";
      }
      return true;
    });
  }

  return applySearchAndDate(filteredExceptions, "requestDate", (i) => [
    i.profileName,
    i.profileCode,
    i.nationalId,
    i.department,
    i.roomNumber,
    i.buildingName,
    i.violationType,
    i.violationDetails,
    i.approvedBy,
    i.approvalStatus,
    i.resolutionDetails,
    i.resolvedAt,
    i.overrideReason,
    i.severity,
    i.requestDate,
  ]);
}
