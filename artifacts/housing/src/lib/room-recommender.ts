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
  const l5Cap = Number(policySettings?.policyLevel5Capacity) || 5;
  const l6Cap = Number(policySettings?.policyLevel6Capacity) || 6;

  // Check user-defined dynamic custom rules first
  const customRules: any[] = Array.isArray(policySettings?.customLevelRules)
    ? policySettings.customLevelRules
    : [];
  const matchedCustom = customRules.find((cr: any) => {
    const crName = String(cr.name || "").trim().toLowerCase();
    const crNameAr = String(cr.nameAr || "").trim().toLowerCase();
    return (
      (crName && lvl === crName) ||
      (crNameAr && lvl === crNameAr) ||
      (crName && lvl.includes(crName)) ||
      (crNameAr && lvl.includes(crNameAr))
    );
  });

  if (matchedCustom) {
    const cap = Math.max(1, Number(matchedCustom.capacity) || 4);
    return {
      minCap: 1,
      maxCap: cap,
      idealCap: cap,
      levelNameAr: matchedCustom.nameAr || matchedCustom.name,
      levelNameEn: matchedCustom.name || matchedCustom.nameAr,
    };
  }

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

  // Level 5: Extra capacity (default 5 beds)
  if (
    lvl === "5" ||
    lvl === "level 5" ||
    lvl.includes("خامس") ||
    lvl.includes("مستوى 5") ||
    lvl.includes("درجة 5")
  ) {
    return {
      minCap: 1,
      maxCap: l5Cap,
      idealCap: l5Cap,
      levelNameAr: "عمال ومعاونون (المستوى 5 - سعة 5)",
      levelNameEn: "Support Staff (Level 5 - 5 Beds)",
    };
  }

  // Level 6: High capacity shared accommodation (default 6 beds)
  if (
    lvl === "6" ||
    lvl === "level 6" ||
    lvl.includes("سادس") ||
    lvl.includes("مستوى 6") ||
    lvl.includes("درجة 6")
  ) {
    return {
      minCap: 1,
      maxCap: l6Cap,
      idealCap: l6Cap,
      levelNameAr: "سكن جماعي مكثف (المستوى 6 - سعة 6)",
      levelNameEn: "Intensive Shared (Level 6 - 6 Beds)",
    };
  }

  // Level 4 / General Workers: Shared Rooms / Line Staff
  return {
    minCap: 1,
    maxCap: l4Cap,
    idealCap: l4Cap,
    levelNameAr:
      lvl === "4" || lvl === "level 4"
        ? "عمال وخدمات (المستوى 4)"
        : lvl
        ? `مستوى ${lvl}`
        : "طاقم العمل (المستوى 4)",
    levelNameEn:
      lvl === "4" || lvl === "level 4"
        ? "General Workers (Level 4)"
        : lvl
        ? `Level ${lvl}`
        : "General Staff (Level 4)",
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

  // ── Adaptive Spatial Territory Learning (تعلم قطاعات الأقسام الذكي) ────────
  const adaptiveEnabled = policySettings?.policyAdaptiveLearning !== false;
  const deptBuildingDensity = new Map<string, Map<number, number>>();
  const deptFloorDensity = new Map<string, Map<number, number>>();

  if (adaptiveEnabled && profileDept) {
    for (const a of assignments) {
      if (a.status === "ACTIVE") {
        const occProfile = profileMap.get(a.profileId);
        const dept = (occProfile?.department || "").toLowerCase().trim();
        if (dept) {
          const occRoom = rooms.find((rm) => rm.id === a.roomId);
          if (occRoom) {
            const bId = occRoom.buildingId ?? (occRoom as any).building_id;
            const fId = occRoom.floorId ?? (occRoom as any).floor_id;
            if (bId != null) {
              if (!deptBuildingDensity.has(dept)) deptBuildingDensity.set(dept, new Map());
              const bMap = deptBuildingDensity.get(dept)!;
              bMap.set(bId, (bMap.get(bId) || 0) + 1);
            }
            if (fId != null) {
              if (!deptFloorDensity.has(dept)) deptFloorDensity.set(dept, new Map());
              const fMap = deptFloorDensity.get(dept)!;
              fMap.set(fId, (fMap.get(fId) || 0) + 1);
            }
          }
        }
      }
    }
  }

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

    // 1. Gender Compatibility Check (with Strict Segregation Support)
    const roomGender = (r.gender || "").toLowerCase();
    const existingOccupants = (activeAssignmentsByRoom[r.id] || []).map((a) =>
      profileMap.get(a.profileId)
    ).filter(Boolean);

    const strictGender = policySettings?.policyStrictGenderSegregation !== false;

    if (profileGender) {
      if (roomGender && roomGender !== "any" && roomGender !== "all") {
        if (roomGender !== profileGender) {
          if (strictGender) continue; // Incompatible gender strictly rejected
          score -= 100;
        } else {
          score += 20;
        }
      }
      // Check existing roommates genders
      const hasConflictingGender = existingOccupants.some((occ) => {
        const occG = (occ.gender || "").toLowerCase();
        return occG && occG !== profileGender;
      });
      if (hasConflictingGender) {
        if (strictGender) continue; // Cannot mix genders under strict policy
        score -= 150;
      }
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

    // 4. Department Harmony, Clustering Policy & Adaptive Learning
    const clusterEnabled = policySettings?.policyDepartmentClustering ?? true;
    const strictSegregation = policySettings?.policyStrictDepartmentSegregation ?? false;

    if (profileDept) {
      if (existingOccupants.length > 0) {
        const sameDeptCount = existingOccupants.filter(
          (o) => (o.department || "").toLowerCase().trim() === profileDept
        ).length;
        const diffDeptCount = existingOccupants.filter(
          (o) => (o.department || "").toLowerCase().trim() !== profileDept && (o.department || "").trim() !== ""
        ).length;

        if (strictSegregation && diffDeptCount > 0) {
          // Disqualify room if strict segregation is turned on
          continue;
        }

        if (sameDeptCount > 0) {
          const adaptiveBoost = adaptiveEnabled ? 80 : 65;
          score += adaptiveBoost; // High priority boost to cluster colleagues together!
          matchReasonAr += ` • 🤖 تطابق ذكي: توافق مع زملاء من قسم (${profile?.department}) [تعلم سلوكي]`;
          matchReasonEn += ` • 🤖 Smart match: Colleagues from department (${profile?.department}) [Adaptive AI]`;
        } else if (clusterEnabled && diffDeptCount > 0) {
          score -= 30; // Prefer rooms with same department or empty rooms
        }
      } else if (adaptiveEnabled) {
        // Room is vacant: Check spatial sector affinity for this department!
        const bId = r.buildingId ?? (r as any).building_id;
        const fId = r.floorId ?? (r as any).floor_id;
        const bCount = (bId != null && deptBuildingDensity.get(profileDept)?.get(bId)) || 0;
        const fCount = (fId != null && deptFloorDensity.get(profileDept)?.get(fId)) || 0;

        if (fCount >= 2 || bCount >= 4) {
          score += 45;
          matchReasonAr += ` • 🤖 قطاع مفضل لقسم (${profile?.department}) في المبنى/الدور [تعلم مكاني]`;
          matchReasonEn += ` • 🤖 Preferred spatial sector for (${profile?.department}) [AI Learned]`;
        }
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

  // 4. Strict Gender Segregation Check
  const strictGender = policySettings?.policyStrictGenderSegregation !== false;
  const profileGender = (profile.gender || "").trim().toLowerCase();
  if (strictGender && profileGender) {
    const roomGender = (room.gender || "").trim().toLowerCase();
    if (roomGender && roomGender !== "any" && roomGender !== "all" && roomGender !== profileGender) {
      violations.push({
        code: "GENDER_ROOM_MISMATCH",
        messageAr: `مخالفة سياسة فصل الجنسين الصارمة: الغرفة مخصصة لـ (${roomGender === "female" ? "الإناث" : "الذكور"}) بينما الموظف (${profileGender === "female" ? "أنثى" : "ذكر"})`,
        messageEn: `Strict gender segregation violation: Room is designated for (${roomGender}) while employee is (${profileGender})`,
      });
    }

    const conflictingRoommates = existingRoommates.filter((rm: any) => {
      const g = (rm.gender || "").trim().toLowerCase();
      return g && g !== profileGender;
    });
    if (conflictingRoommates.length > 0) {
      violations.push({
        code: "GENDER_ROOMMATE_MISMATCH",
        messageAr: `مخالفة سياسة فصل الجنسين الصارمة: لا يجوز تسكين موظف وموظفة في نفس الغرفة المشتركة نهائياً`,
        messageEn: `Strict gender segregation violation: Mixed-gender shared accommodation is strictly prohibited`,
      });
    }
  }

  // 5. Strict Family Segregation Check
  const strictFamily = policySettings?.policyStrictFamilySegregation !== false;
  if (strictFamily) {
    const roomCls = (room.classification || room.roomType || "").toLowerCase();
    const isFamilyRoom =
      roomCls.includes("family") ||
      roomCls.includes("عائل") ||
      roomCls.includes("suite") ||
      roomCls.includes("جناح");
    const isFamilyEmp = Boolean(
      profile.isFamily === true ||
      (profile.guestType || "").toLowerCase() === "family" ||
      (profile.jobTitle || profile.title || "").toLowerCase().includes("عائل")
    );

    if (!isFamilyEmp && isFamilyRoom && !isEntireRoom) {
      violations.push({
        code: "FAMILY_ROOM_RESERVED",
        messageAr: `مخالفة سياسة سكن العائلات الصارمة: هذه الغرفة/الجناح مخصص لسكن العائلات فقط ولا يجوز تسكين أفراد بها إلا باستثناء إداري`,
        messageEn: `Strict family segregation violation: This room/suite is reserved for families; single staff requires approved exception`,
      });
    }

    if (isFamilyEmp && existingRoommates.length > 0) {
      violations.push({
        code: "FAMILY_SHARED_VIOLATION",
        messageAr: `مخالفة سياسة سكن العائلات: لا يمكن تسكين عائلة في غرفة مشتركة مع موظفين آخرين`,
        messageEn: `Family housing policy violation: Families cannot be placed in shared accommodation with other staff`,
      });
    }
  }

  return {
    compliant: violations.length === 0,
    violations,
  };
}
