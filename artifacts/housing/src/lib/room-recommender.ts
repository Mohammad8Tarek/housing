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

export function getLevelTargetCapacity(levelRaw: string | number | null | undefined): {
  minCap: number;
  maxCap: number;
  idealCap: number;
  levelNameAr: string;
  levelNameEn: string;
} {
  const lvl = String(levelRaw || "").trim().toLowerCase();

  // Level 1: Top Management / Directors / General Managers
  if (
    lvl === "1" ||
    lvl.includes("إدارة عليا") ||
    lvl.includes("مدير عام") ||
    lvl.includes("gm") ||
    lvl.includes("director") ||
    lvl.includes("hod")
  ) {
    return {
      minCap: 1,
      maxCap: 1,
      idealCap: 1,
      levelNameAr: "إدارة عليا (Level 1)",
      levelNameEn: "Top Management (Level 1)",
    };
  }

  // Level 2: Supervisors / Middle Management / Assistant Managers
  if (
    lvl === "2" ||
    lvl.includes("إشراف") ||
    lvl.includes("مشرف") ||
    lvl.includes("supervisor") ||
    lvl.includes("executive") ||
    lvl.includes("manager")
  ) {
    return {
      minCap: 1,
      maxCap: 2,
      idealCap: 2,
      levelNameAr: "مستوى إشرافي (Level 2)",
      levelNameEn: "Supervisory (Level 2)",
    };
  }

  // Level 3: Senior Staff / Specialists / Technicians
  if (
    lvl === "3" ||
    lvl.includes("فني") ||
    lvl.includes("specialist") ||
    lvl.includes("senior") ||
    lvl.includes("special")
  ) {
    return {
      minCap: 2,
      maxCap: 3,
      idealCap: 2,
      levelNameAr: "مستوى مهني متخصص (Level 3)",
      levelNameEn: "Senior Staff (Level 3)",
    };
  }

  // Level 4 / Staff: General Staff / Operations
  return {
    minCap: 2,
    maxCap: 4,
    idealCap: 3,
    levelNameAr: lvl ? `مستوى ${lvl}` : "طاقم العمل (Staff)",
    levelNameEn: lvl ? `Level ${lvl}` : "General Staff",
  };
}

export function recommendBestRooms({
  profile,
  rooms,
  assignments = [],
  profiles = [],
  preferences = {},
}: {
  profile: {
    level?: string | number | null;
    gender?: string | null;
    department?: string | null;
    nationality?: string | null;
  } | null;
  rooms: any[];
  assignments?: any[];
  profiles?: any[];
  /** Optional caller-supplied preferences to influence scoring */
  preferences?: {
    preferredView?: string;       // e.g. "Sea view", "Tal View"
    preferredBedType?: string;    // e.g. "Twin Bed", "Single Bed"
    preferredClassification?: string; // e.g. "Deluxe room"
    requiredFeatures?: string[];  // e.g. ["Balcony", "WiFi"]
    sameNationality?: boolean;    // prefer roommates of same nationality
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

  const target = getLevelTargetCapacity(profileLevel);

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

    // 4. Department Harmony Bonus (if room has fellow department colleagues)
    if (profileDept && existingOccupants.length > 0) {
      const sameDeptCount = existingOccupants.filter(
        (o) => (o.department || "").toLowerCase() === profileDept
      ).length;
      if (sameDeptCount > 0) {
        score += 15;
        matchReasonAr += ` • زملاء من نفس القسم (${profile?.department})`;
        matchReasonEn += ` • Roommates from same department (${profile?.department})`;
      }
    }

    // 5. Prefer vacant rooms for Level 1
    if (target.idealCap === 1 && roomOcc === 0) {
      score += 30;
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

    // ── NEW: 8. Room Classification Preference ────────────────────────────────
    if (preferredClassification) {
      const rc = (r.classification || r.roomType || "").toLowerCase();
      if (rc.includes(preferredClassification.toLowerCase())) {
        score += 12;
        matchReasonAr += ` • تصنيف مطابق (${r.classification || r.roomType})`;
        matchReasonEn += ` • Classification match (${r.classification || r.roomType})`;
      }
    }

    // ── NEW: 9. Required Features Check ──────────────────────────────────────
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
      // Penalize rooms missing ALL required features
      if (matchedFeatures.length === 0) {
        score -= 5;
      }
    }

    // ── NEW: 10. Nationality Harmony Bonus ────────────────────────────────────
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

    const badgeLabelAr = levelMatch
      ? `⭐ الأنسب لمستوى ${profileLevel || "الوظيفة"}`
      : "متاحة";
    const badgeLabelEn = levelMatch
      ? `⭐ Best for Level ${profileLevel || ""}`
      : "Available";

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
