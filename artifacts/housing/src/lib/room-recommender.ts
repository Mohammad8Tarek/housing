/**
 * Room Recommendation Engine based on Employee Level, Gender, and Department
 */

export type RecommendationResult = {
  room: any;
  score: number;
  availableBeds: number;
  levelMatch: boolean;
  matchReasonAr: string;
  matchReasonEn: string;
  badgeLabelAr: string;
  badgeLabelEn: string;
};

export function getLevelTargetCapacity(
  levelRaw: string | number | null | undefined,
  policySettings?: any,
): {
  minCap: number;
  maxCap: number;
  idealCap: number;
  levelNameAr: string;
  levelNameEn: string;
} {
  const lvl = String(levelRaw ?? "").trim().toLowerCase();

  const l0Cap = Number(policySettings?.policyLevel0Capacity) || 1;
  const l1Cap = Number(policySettings?.policyLevel1Capacity) || 1;
  const l2Cap = Number(policySettings?.policyLevel2Capacity) || 2;
  const l3Cap = Number(policySettings?.policyLevel3Capacity) || 3;
  const l4Cap = Number(policySettings?.policyLevel4Capacity) || 4;

  // Level 0: Top Management / Executives / General Managers / Corporate Directors / VIP
  // Highest entitlement: Single room / Private Suite / Deluxe accommodation
  if (
    lvl === "0" ||
    lvl === "level 0" ||
    lvl === "vip" ||
    lvl.includes("قيادات") ||
    lvl.includes("عليا") ||
    lvl.includes("إدارة عليا") ||
    lvl.includes("chief") ||
    lvl.includes("controller") ||
    lvl.includes("gm") ||
    lvl.includes("general manager") ||
    lvl.includes("director") ||
    lvl.includes("cluster")
  ) {
    return {
      minCap: 1,
      maxCap: l0Cap,
      idealCap: l0Cap,
      levelNameAr: "إدارة عليا / قيادات (المستوى 0)",
      levelNameEn: "Executive / Top Management (Level 0)",
    };
  }

  // Level 1: Department Heads / Middle Management / Operations Managers
  if (
    lvl === "1" ||
    lvl === "level 1" ||
    lvl.includes("مدير إدارة") ||
    lvl.includes("مدير قسم") ||
    lvl.includes("مدير فندق") ||
    lvl.includes("head") ||
    lvl.includes("hod")
  ) {
    return {
      minCap: 1,
      maxCap: l1Cap,
      idealCap: l1Cap,
      levelNameAr: "مدراء أقسام / إدارة وسطى (المستوى 1)",
      levelNameEn: "Department Heads (Level 1)",
    };
  }

  // Level 2: Supervisors / Assistant Managers / Specialists
  if (
    lvl === "2" ||
    lvl === "level 2" ||
    lvl.includes("إشراف") ||
    lvl.includes("مشرف") ||
    lvl.includes("supervisor") ||
    lvl.includes("assistant manager") ||
    lvl.includes("specialist") ||
    lvl.includes("نائب")
  ) {
    return {
      minCap: 1,
      maxCap: l2Cap,
      idealCap: l2Cap,
      levelNameAr: "مستوى إشرافي (المستوى 2)",
      levelNameEn: "Supervisory (Level 2)",
    };
  }

  // Level 3: Staff / Senior Technicians / Officers
  if (
    lvl === "3" ||
    lvl === "level 3" ||
    lvl.includes("فني") ||
    lvl.includes("technician") ||
    lvl.includes("senior") ||
    lvl.includes("officer") ||
    lvl.includes("موظف")
  ) {
    return {
      minCap: 1,
      maxCap: l3Cap,
      idealCap: l3Cap,
      levelNameAr: "موظفون وفنيون (المستوى 3)",
      levelNameEn: "Staff & Technicians (Level 3)",
    };
  }

  // Level 4 / General Workers: Shared Rooms / Line Staff
  return {
    minCap: 1,
    maxCap: l4Cap,
    idealCap: l4Cap,
    levelNameAr: lvl === "4" || lvl === "level 4" ? "عمال وخدمات (المستوى 4)" : (lvl ? `مستوى ${lvl}` : "طاقم العمل (المستوى 4)"),
    levelNameEn: lvl === "4" || lvl === "level 4" ? "General Workers (Level 4)" : (lvl ? `Level ${lvl}` : "General Staff (Level 4)"),
  };
}

export function recommendBestRooms({
  profile,
  rooms,
  assignments = [],
  profiles = [],
  preferences = {},
  policySettings = {},
}: {
  profile: {
    level?: string | number | null;
    gender?: string | null;
    department?: string | null;
    nationality?: string | null;
    jobTitle?: string | null;
    title?: string | null;
    isFamily?: boolean;
    guestType?: string | null;
  } | null;
  rooms: any[];
  assignments?: any[];
  profiles?: any[];
  policySettings?: any;
  /** Optional caller-supplied preferences to influence scoring */
  preferences?: {
    preferredView?: string;       // e.g. "Sea view", "Tal View"
    preferredBedType?: string;    // e.g. "Twin Bed", "Single Bed"
    preferredClassification?: string; // e.g. "Deluxe room"
    requiredFeatures?: string[];  // e.g. ["Balcony", "WiFi"]
    sameNationality?: boolean;    // prefer roommates of same nationality
    isFamily?: boolean;           // prioritize family suites
  };
}): {
  bestRoom: any | null;
  scoredRooms: RecommendationResult[];
  recommendedMap: Record<number, RecommendationResult>;
} {
  if (!rooms || rooms.length === 0) {
    return { bestRoom: null, scoredRooms: [], recommendedMap: {} };
  }

  // Map assignments to active occupants
  const activeAssignmentsByRoom: Record<number, any[]> = {};
  for (const a of assignments) {
    if (a.status === "ACTIVE") {
      if (!activeAssignmentsByRoom[a.roomId]) activeAssignmentsByRoom[a.roomId] = [];
      activeAssignmentsByRoom[a.roomId].push(a);
    }
  }

  const profileMap = new Map<number, any>();
  for (const p of profiles) {
    profileMap.set(p.id, p);
  }

  const profileLevel = profile?.level;
  const profileGender = (profile?.gender || "").toLowerCase();
  const profileDept = (profile?.department || "").toLowerCase();
  const profileNat = (profile?.nationality || "").toLowerCase();

  const target = getLevelTargetCapacity(profileLevel, policySettings);

  const {
    preferredView = "",
    preferredBedType = "",
    preferredClassification = "",
    requiredFeatures = [],
    sameNationality = false,
  } = preferences;

  const scored: RecommendationResult[] = [];

  for (const r of rooms) {
    const status = (r.status || "").toLowerCase();
    // Strictly exclude Out of Order and Out of Service
    if (status === "out_of_order" || status === "ooo" || status === "out_of_service" || status === "oos") {
      continue;
    }

    const roomCapacity = r.capacity || 1;
    const roomOcc = r.currentOccupancy ?? (activeAssignmentsByRoom[r.id]?.length ?? 0);
    const availableBeds = Math.max(0, roomCapacity - roomOcc);

    // If completely full, skip
    if (availableBeds <= 0) continue;

    let score = 50; // base score for having an open bed

    // 1. Gender Compatibility Check
    const roomGender = (r.gender || "").toLowerCase();
    const existingOccupants = (activeAssignmentsByRoom[r.id] || []).map((a) =>
      profileMap.get(a.profileId)
    ).filter(Boolean);

    if (profileGender) {
      if (roomGender && roomGender !== "any" && roomGender !== "all") {
        if (roomGender !== profileGender) continue; // Incompatible gender
        score += 20;
      }
      // Check existing roommates genders
      const hasConflictingGender = existingOccupants.some((occ) => {
        const occG = (occ.gender || "").toLowerCase();
        return occG && occG !== profileGender;
      });
      if (hasConflictingGender) continue; // Cannot mix genders
    }

    // 2. Capacity & Level Matching
    let levelMatch = false;
    let matchReasonAr = "";
    let matchReasonEn = "";

    if (roomCapacity === target.idealCap) {
      score += 40;
      levelMatch = true;
      matchReasonAr = `مطابقة مثالية لسعة الغرفة (${roomCapacity} سرير) مع ${target.levelNameAr}`;
      matchReasonEn = `Ideal capacity match (${roomCapacity} bed) for ${target.levelNameEn}`;
    } else if (roomCapacity >= target.minCap && roomCapacity <= target.maxCap) {
      score += 25;
      levelMatch = true;
      matchReasonAr = `مناسبة لسعة الغرفة (${roomCapacity} سرير) مع ${target.levelNameAr}`;
      matchReasonEn = `Suitable capacity (${roomCapacity} bed) for ${target.levelNameEn}`;
    } else {
      score -= 15;
      matchReasonAr = `سعة الغرفة (${roomCapacity} سرير) مختلفة عن المستوى المقترح (${target.idealCap} سرير)`;
      matchReasonEn = `Capacity (${roomCapacity}) differs from recommended (${target.idealCap})`;
    }

    // 3. Room Cleanliness Bonus
    if (status === "available" || status === "vacant") {
      score += 20; // Ready for instant check-in
    } else if (status === "dirty") {
      score -= 10; // Needs housekeeping
    }

    // 4. Department Harmony & Clustering Policy
    const clusterEnabled = policySettings?.policyDepartmentClustering ?? true;
    const strictSegregation = policySettings?.policyStrictDepartmentSegregation ?? false;

    if (profileDept && existingOccupants.length > 0) {
      const sameDeptCount = existingOccupants.filter(
        (o) => (o.department || "").toLowerCase() === profileDept
      ).length;
      const diffDeptCount = existingOccupants.filter(
        (o) => (o.department || "").toLowerCase() !== profileDept && (o.department || "").trim() !== ""
      ).length;

      if (strictSegregation && diffDeptCount > 0) {
        // Disqualify room if strict segregation is turned on
        continue;
      }

      if (clusterEnabled && sameDeptCount > 0) {
        score += 65; // High priority boost to cluster colleagues together!
        matchReasonAr += ` • مطابقة القسم (${profile?.department}) مع زملاء الغرفة`;
        matchReasonEn += ` • Department match (${profile?.department}) with roommates`;
      } else if (clusterEnabled && diffDeptCount > 0) {
        score -= 25; // Prefer rooms with same department or empty rooms
      }
    }

    // 5. Prefer vacant rooms for Level 0 and Level 1
    if (target.idealCap === 1 && roomOcc === 0) {
      score += 40;
    }

    // ── NEW: 6. Room View Preference ──────────────────────────────────────────
    if (preferredView) {
      const rv = (r.view || "").toLowerCase();
      if (rv && rv.includes(preferredView.toLowerCase())) {
        score += 18;
        matchReasonAr += ` • إطلالة مفضلة (${r.view})`;
        matchReasonEn += ` • Preferred view (${r.view})`;
      }
    }

    // ── NEW: 7. Bed Type Preference ───────────────────────────────────────────
    if (preferredBedType) {
      const rbt = (r.bedType || "").toLowerCase();
      if (rbt && rbt.includes(preferredBedType.toLowerCase())) {
        score += 15;
        matchReasonAr += ` • نوع السرير المفضل (${r.bedType})`;
        matchReasonEn += ` • Preferred bed type (${r.bedType})`;
      }
    }

    // ── 8. Smart Room Classification & Job Title / Family Match ──────────────
    const roomCls = (r.classification || "").toLowerCase();
    const profileJobTitle = (profile?.jobTitle || profile?.title || "").toLowerCase();
    const isFamilyTarget =
      profile?.isFamily === true ||
      preferences.isFamily === true ||
      (profile?.guestType || "").toLowerCase() === "family" ||
      profileJobTitle.includes("عائل") ||
      preferredClassification.toLowerCase().includes("family");

    const lvlStr = String(profileLevel ?? "").trim().toLowerCase();
    const isTopExecutive =
      lvlStr === "0" ||
      lvlStr === "level 0" ||
      lvlStr === "vip" ||
      lvlStr.includes("إدارة عليا") ||
      lvlStr.includes("قيادات") ||
      profileJobTitle.includes("general manager") ||
      profileJobTitle.includes("مدير عام") ||
      profileJobTitle.includes("chief") ||
      profileJobTitle.includes("controller") ||
      profileJobTitle.includes("cluster") ||
      profileJobTitle.includes("director");

    const isExecutive =
      !isTopExecutive &&
      (lvlStr === "1" ||
      lvlStr === "level 1" ||
      profileJobTitle.includes("مدير إدارة") ||
      profileJobTitle.includes("مدير فندق") ||
      profileJobTitle.includes("مدير قسم") ||
      profileJobTitle.includes("head") ||
      profileJobTitle.includes("hod") ||
      profileJobTitle.includes("executive"));

    const isSupervisory =
      lvlStr === "2" ||
      lvlStr === "level 2" ||
      profileJobTitle.includes("مشرف") ||
      profileJobTitle.includes("نائب") ||
      profileJobTitle.includes("مسؤول") ||
      profileJobTitle.includes("supervisor") ||
      profileJobTitle.includes("assistant manager") ||
      profileJobTitle.includes("specialist");

    let customBadgeLabelAr = "";
    let customBadgeLabelEn = "";

    // 8.1 Family match
    if (isFamilyTarget) {
      if (roomCls.includes("family") || roomCls.includes("suite") || roomCls.includes("عائل")) {
        score += 60;
        levelMatch = true;
        matchReasonAr += ` • جناح عائلي متسع ملائم للأسرة (${r.classification || "Family suite"} - سعة ${roomCapacity} أفراد)`;
        matchReasonEn += ` • Family suite ideal for family housing (${r.classification || "Family suite"} - capacity ${roomCapacity})`;
        customBadgeLabelAr = "سكن عائلي";
        customBadgeLabelEn = "Family";
      } else if (roomCapacity >= 3) {
        score += 30;
        matchReasonAr += ` • سعة رحبة مناسبة (${roomCapacity} سرير)`;
      } else {
        score -= 25; // Small rooms are bad for families
      }
    } else {
      // If NOT a family, avoid putting single workers in family suites if other rooms exist
      if (roomCls.includes("family")) {
        score -= 20;
      }
    }

    // 8.2 Top Executive / Level 0 (VIP Suites, Deluxe, Single)
    if (isTopExecutive) {
      if (roomCls.includes("deluxe") || roomCls.includes("ديلوكس") || roomCls.includes("suite") || roomCls.includes("جناح")) {
        score += 70;
        levelMatch = true;
        matchReasonAr += ` • جناح / غرفة فاخرة ملائمة للإدارة العليا (${r.classification || "VIP / Suite"})`;
        matchReasonEn += ` • Suite / Deluxe room matching Top Executive (${r.classification || "VIP / Suite"})`;
        customBadgeLabelAr = "إدارة عليا VIP";
        customBadgeLabelEn = "Top Executive VIP";
      } else if (roomCls.includes("superior") || roomCls.includes("سوبيريور") || roomCapacity === 1) {
        score += 50;
        levelMatch = true;
        matchReasonAr += ` • غرفة فردية متميزة (${r.classification || "غرفة فردية"})`;
        matchReasonEn += ` • Single/Superior room (${r.classification || "Single"})`;
        customBadgeLabelAr = "إدارة عليا";
        customBadgeLabelEn = "Top Exec";
      }
      if (roomOcc === 0) {
        score += 35; // Priority for vacant room
      }
      if (roomCapacity > target.maxCap) {
        score -= 75; // Heavy penalty if placed in shared multi-bed room
      }
    } else if (isExecutive) {
      if (roomCls.includes("deluxe") || roomCls.includes("ديلوكس")) {
        score += 45;
        levelMatch = true;
        matchReasonAr += ` • تصنيف فاخر ملائم للمنصب القيادي (${r.classification})`;
        matchReasonEn += ` • Deluxe classification matching executive title (${r.classification})`;
        customBadgeLabelAr = r.classification || "تنفيذي";
        customBadgeLabelEn = r.classification || "Executive";
      } else if (roomCls.includes("superior") || roomCls.includes("سوبيريور") || roomCapacity === 1) {
        score += 35;
        levelMatch = true;
        matchReasonAr += ` • تصنيف ممتاز (${r.classification})`;
        matchReasonEn += ` • Superior classification (${r.classification})`;
      }
      if (roomOcc === 0) {
        score += 25;
      }
      if (roomCapacity > target.maxCap) {
        score -= 50;
      }
    } else if (isSupervisory) {
      if (roomCls.includes("superior") || roomCls.includes("سوبيريور")) {
        score += 40;
        levelMatch = true;
        matchReasonAr += ` • تصنيف سوبيريور مناسب للمستوى الإشرافي (${r.classification})`;
        matchReasonEn += ` • Superior room matching supervisory title (${r.classification})`;
        customBadgeLabelAr = r.classification || "إشرافي";
        customBadgeLabelEn = r.classification || "Supervisory";
      } else if (roomCls.includes("deluxe")) {
        score += 25;
      }
    } else if (!isFamilyTarget) {
      // Regular staff / workers (Levels 3 and 4)
      if (roomCls.includes("standard") || !r.classification) {
        score += 15;
      }
      if (roomCls.includes("suite") || roomCls.includes("جناح") || (roomCls.includes("deluxe") && roomCapacity === 1)) {
        score -= 40;
      }
    }

    // Direct classification preference match
    if (preferredClassification) {
      const rc = (r.classification || r.roomType || "").toLowerCase();
      if (rc.includes(preferredClassification.toLowerCase())) {
        score += 20;
        matchReasonAr += ` • تصنيف مطابق (${r.classification || r.roomType})`;
        matchReasonEn += ` • Classification match (${r.classification || r.roomType})`;
      }
    }

    // ── 9. Required Features Check ──────────────────────────────────────
    if (requiredFeatures.length > 0) {
      const roomFeaturesList: string[] = Array.isArray(r.featuresList)
        ? r.featuresList.map((f: string) => f.toLowerCase())
        : (r.features || "").toLowerCase().split(/[,;\n]+/).map((f: string) => f.trim());
      const matchedFeatures = requiredFeatures.filter((f) =>
        roomFeaturesList.some((rf) => rf.includes(f.toLowerCase()))
      );
      if (matchedFeatures.length > 0) {
        score += matchedFeatures.length * 8;
        matchReasonAr += ` • مميزات مطلوبة متوفرة: ${matchedFeatures.join(", ")}`;
        matchReasonEn += ` • Required features available: ${matchedFeatures.join(", ")}`;
      }
      if (matchedFeatures.length === 0) {
        score -= 5;
      }
    }

    // ── 10. Nationality Harmony Bonus ────────────────────────────────────
    if (sameNationality && profileNat && existingOccupants.length > 0) {
      const sameNatCount = existingOccupants.filter(
        (o) => (o.nationality || "").toLowerCase() === profileNat
      ).length;
      if (sameNatCount > 0) {
        score += 10;
        matchReasonAr += ` • زملاء من نفس الجنسية`;
        matchReasonEn += ` • Same-nationality roommates`;
      }
    }

    const targetRoleAr = profile?.jobTitle ? profile.jobTitle : (profileLevel ? `مستوى ${profileLevel}` : "الموظف");
    const targetRoleEn = profile?.jobTitle ? profile.jobTitle : (profileLevel ? `Level ${profileLevel}` : "Role");
    const badgeLabelAr = customBadgeLabelAr || (levelMatch
      ? (r.classification || targetRoleAr || "موصى بها")
      : "متاحة");
    const badgeLabelEn = customBadgeLabelEn || (levelMatch
      ? (r.classification || targetRoleEn || "Recommended")
      : "Available");

    scored.push({
      room: r,
      score,
      availableBeds,
      levelMatch,
      matchReasonAr,
      matchReasonEn,
      badgeLabelAr,
      badgeLabelEn,
    });
  }

  // Sort descending by score
  scored.sort((a, b) => b.score - a.score);

  const recommendedMap: Record<number, RecommendationResult> = {};
  for (const item of scored) {
    recommendedMap[item.room.id] = item;
  }

  return {
    bestRoom: scored[0]?.room || null,
    scoredRooms: scored,
    recommendedMap,
  };
}

export function checkPolicyCompliance({
  profile,
  room,
  assignments = [],
  profiles = [],
  policySettings = {},
  isEntireRoom = false,
}: {
  profile: any;
  room: any;
  assignments?: any[];
  profiles?: any[];
  policySettings?: any;
  isEntireRoom?: boolean;
}): {
  compliant: boolean;
  violations: { code: string; messageAr: string; messageEn: string }[];
} {
  const violations: { code: string; messageAr: string; messageEn: string }[] = [];
  if (!profile || !room) return { compliant: true, violations };

  const target = getLevelTargetCapacity(profile.level, policySettings);
  const roomCap = room.capacity || 1;

  // 1. Capacity & Level Check
  if (roomCap > target.maxCap) {
    violations.push({
      code: "CAPACITY_EXCEEDED",
      messageAr: `سعة الغرفة (${roomCap} أفراد) تتجاوز الحد الأقصى المسموح لـ ${target.levelNameAr} (${target.maxCap} أفراد)`,
      messageEn: `Room capacity (${roomCap}) exceeds maximum allowed for ${target.levelNameEn} (${target.maxCap} persons)`,
    });
  }

  // 2. Entire room booking validation
  const allowL0Entire = policySettings?.policyLevel0AllowEntire ?? true;
  const allowL1Entire = policySettings?.policyLevel1AllowEntire ?? true;
  const allowL2Entire = policySettings?.policyLevel2AllowEntire ?? false;
  const lvl = String(profile.level ?? "").trim().toLowerCase();
  const isL0 =
    lvl === "0" ||
    lvl === "level 0" ||
    lvl === "vip" ||
    lvl.includes("قيادات") ||
    lvl.includes("إدارة عليا") ||
    lvl.includes("chief") ||
    lvl.includes("controller") ||
    lvl.includes("gm") ||
    lvl.includes("director");
  const isL1 = !isL0 && (lvl === "1" || lvl === "level 1" || lvl.includes("مدير"));
  const isL2 = !isL0 && !isL1 && (lvl === "2" || lvl === "level 2" || lvl.includes("مشرف") || lvl.includes("supervisor"));

  if (isEntireRoom) {
    const isAllowedEntire = (isL0 && allowL0Entire) || (isL1 && allowL1Entire) || (isL2 && allowL2Entire);
    if (!isAllowedEntire) {
      violations.push({
        code: "ENTIRE_ROOM_NOT_ALLOWED",
        messageAr: `حجز الغرفة بالكامل غير مسموح لـ ${target.levelNameAr} وفقاً لسياسة السكن`,
        messageEn: `Booking entire room is not permitted for ${target.levelNameEn} according to housing policy`,
      });
    }
  }

  // 3. Department Segregation & Roommates
  const profileDept = (profile.department || "").trim().toLowerCase();
  const profileMap = new Map<number, any>(profiles.map((p: any) => [p.id, p]));
  const roomActiveAssignments = (assignments || []).filter(
    (a: any) => a.roomId === room.id && a.status === "ACTIVE" && a.profileId !== profile.id
  );
  const existingRoommates = roomActiveAssignments.map((a: any) => profileMap.get(a.profileId)).filter(Boolean);

  if (profileDept && existingRoommates.length > 0) {
    const diffDeptOccupants = existingRoommates.filter(
      (r: any) => (r.department || "").trim().toLowerCase() !== profileDept && (r.department || "").trim() !== ""
    );
    if (policySettings?.policyStrictDepartmentSegregation && diffDeptOccupants.length > 0) {
      violations.push({
        code: "STRICT_DEPT_VIOLATION",
        messageAr: `مخالفة سياسة فصل الأقسام: الغرفة تضم نزلاء من أقسام أخرى (${diffDeptOccupants.map((o: any) => o.department).join(", ")})`,
        messageEn: `Department segregation violation: Room contains occupants from other departments (${diffDeptOccupants.map((o: any) => o.department).join(", ")})`,
      });
    }
  }

  return {
    compliant: violations.length === 0,
    violations,
  };
}
