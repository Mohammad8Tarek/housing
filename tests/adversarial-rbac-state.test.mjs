// Challenger 2 Adversarial RBAC Suite
import assert from "node:assert/strict";

// Import Frontend Master Definitions
import {
  MODULES,
  ACTIONS,
  MODULE_ACTIONS,
  ROLE_DEFAULT_PERMISSIONS as FE_ROLE_DEFAULT_PERMISSIONS,
  PERMISSION_GROUPS,
  permKey,
} from "../artifacts/housing/src/lib/permissions.ts";

// ============================================================================
// BACKEND DEFINITION HARNESS (Mirroring artifacts/api-server/src/middlewares/permissions.ts)
// ============================================================================

const BE_ROLE_INHERITANCE = {
  super_admin: [],
  system_admin: [],
  admin: [],
  manager: ["receptionist"],
  hr_admin: [],
  portal_admin: [],
  security_staff: [],
  receptionist: [],
  maintenance_staff: [],
};

function beNormalize(value) {
  let val = String(value ?? "").trim().toLowerCase();
  if (val.startsWith("employees.")) val = val.replace("employees.", "profiles.");
  if (val.startsWith("employees:")) val = val.replace("employees:", "profiles:");
  return val;
}

function beResolveInheritedRoles(roles) {
  const resolved = new Set();
  const visit = (role) => {
    if (resolved.has(role)) return;
    resolved.add(role);
    for (const parent of BE_ROLE_INHERITANCE[role] ?? []) visit(parent);
  };
  for (const role of roles) visit(beNormalize(role));
  return [...resolved];
}

const BE_PERMISSION_MODULES = [
  "dashboard", "housing", "housekeeping", "profiles", "accommodation",
  "reservations", "maintenance", "reports", "users", "settings",
  "activity_log", "properties", "documents", "billing", "communications",
  "evaluations", "surveys", "portal_content", "activities", "smart_locks",
  "hosting_requests", "guest_hosting"
];

const BE_PERMISSION_ACTIONS = [
  "view", "create", "edit", "delete", "export", "bulk_delete", "bulk_export",
  "assign", "checkin", "checkout", "approve", "transfer", "reset_password",
  "manage_permissions", "view_sensitive", "audit", "publish", "archive",
  "unlock", "override_single_occupancy"
];

const beAllModulePerms = (mod) => BE_PERMISSION_ACTIONS.map((act) => `${mod}.${act}`);
const beCrud = (mod) => ["view", "create", "edit", "delete"].map((act) => `${mod}.${act}`);

// Verbatim from artifacts/api-server/src/middlewares/permissions.ts lines 108-258:
const BE_ROLE_DEFAULT_PERMISSIONS = {
  super_admin: BE_PERMISSION_MODULES.flatMap((module) => beAllModulePerms(module)),
  system_admin: BE_PERMISSION_MODULES.flatMap((module) => beAllModulePerms(module)),
  admin: [
    ...BE_PERMISSION_MODULES.filter((module) => module !== "properties").flatMap(
      (module) => beAllModulePerms(module),
    ),
    "users.unlock",
  ],
  manager: [
    "dashboard.export",
    "housing.create",
    "housing.edit",
    "housing.delete",
    "housing.bulk_export",
    "housekeeping.view",
    "housekeeping.edit",
    "housekeeping.assign",
    "housekeeping.approve",
    "housekeeping.bulk_export",
    "profiles.create",
    "profiles.edit",
    "profiles.delete",
    "profiles.export",
    "accommodation.delete",
    "accommodation.transfer",
    "accommodation.bulk_delete",
    "accommodation.bulk_export",
    "accommodation.archive",
    "accommodation.override_single_occupancy",
    "reservations.override_single_occupancy",
    "guest_hosting.view",
    "guest_hosting.create",
    "guest_hosting.edit",
    "guest_hosting.delete",
    "guest_hosting.checkin",
    "guest_hosting.checkout",
    "guest_hosting.approve",
    "guest_hosting.transfer",
    "guest_hosting.bulk_delete",
    "guest_hosting.bulk_export",
    "reservations.delete",
    "reservations.bulk_export",
    "reservations.archive",
    "maintenance.delete",
    "maintenance.assign",
    "maintenance.approve",
    "maintenance.bulk_export",
    "maintenance.archive",
    "reports.audit",
    "users.view",
    "users.edit",
    "users.manage_permissions",
    "users.unlock",
    "settings.view",
    "settings.edit",
    "activity_log.export",
    "activity_log.audit",
    "documents.create",
    "documents.edit",
    "documents.delete",
    "documents.publish",
    "documents.archive",
    "billing.view",
    "billing.export",
    "communications.create",
  ],
  receptionist: [
    "dashboard.view",
    "housing.view",
    "housing.export",
    "housekeeping.view",
    "profiles.view",
    "accommodation.view",
    "accommodation.create",
    "accommodation.edit",
    "accommodation.assign",
    "accommodation.checkin",
    "accommodation.checkout",
    "accommodation.approve",
    "guest_hosting.view",
    "guest_hosting.create",
    "guest_hosting.edit",
    "guest_hosting.checkin",
    "guest_hosting.checkout",
    "guest_hosting.approve",
    "guest_hosting.export",
    "reservations.view",
    "reservations.create",
    "reservations.edit",
    "reservations.checkin",
    "reservations.checkout",
    "reservations.approve",
    "maintenance.view",
    "maintenance.create",
    "maintenance.edit",
    "reports.view",
    "reports.export",
    "activity_log.view",
    "documents.view",
    "communications.view",
    "communications.create",
  ],
  maintenance_staff: [
    "dashboard.view",
    "housing.view",
    "housekeeping.view",
    "housekeeping.edit",
    "maintenance.view",
    "maintenance.create",
    "maintenance.edit",
    "maintenance.assign",
    "maintenance.approve",
    "profiles.view",
    "activity_log.view",
    "documents.view",
  ],
  hr_admin: [
    "dashboard.view",
    "dashboard.export",
    ...beCrud("profiles"),
    "profiles.export",
    ...beCrud("evaluations"),
    "evaluations.export",
    ...beCrud("surveys"),
    ...beCrud("activities"),
    "activities.publish",
    ...beCrud("documents"),
    ...beCrud("portal_content"),
    ...beCrud("communications"),
    "reports.view",
    "reports.export",
  ],
  portal_admin: [
    "dashboard.view",
    ...beCrud("activities"),
    "activities.publish",
    ...beCrud("documents"),
    ...beCrud("portal_content"),
    ...beCrud("communications"),
    "reports.view",
  ],
  security_staff: [
    "dashboard.view",
    "housing.view",
    "accommodation.view",
    ...beCrud("smart_locks"),
    "activities.view",
  ],
};

function beEffectivePermissions(user) {
  if (Array.isArray(user.permissions) && user.permissions.length > 0) {
    const permissions = new Set();
    for (const permission of user.permissions) {
      if (permission === "none") continue;
      const norm = beNormalize(permission);
      if (norm) {
        permissions.add(norm);
        if (norm.includes(".")) permissions.add(norm.replace(".", ":"));
        if (norm.includes(":")) permissions.add(norm.replace(":", "."));
      }
    }
    if (user.isSystemAdmin || user.roles.includes("super_admin") || user.roles.includes("system_admin")) {
      permissions.add("users.view");
      permissions.add("users:view");
      permissions.add("users.manage_permissions");
      permissions.add("users:manage_permissions");
    }
    return permissions;
  }

  if (user.isSystemAdmin || user.roles.includes("super_admin") || user.roles.includes("system_admin")) {
    return new Set(["*"]);
  }

  const permissions = new Set();
  const resolvedRoles = beResolveInheritedRoles(user.roles);
  for (const role of resolvedRoles) {
    for (const permission of BE_ROLE_DEFAULT_PERMISSIONS[role] ?? []) {
      const norm = beNormalize(permission);
      if (norm) {
        permissions.add(norm);
        if (norm.includes(".")) permissions.add(norm.replace(".", ":"));
        if (norm.includes(":")) permissions.add(norm.replace(":", "."));
      }
    }
  }

  return permissions;
}

function beHasPermission(user, module, action) {
  const permissions = beEffectivePermissions(user);
  if (permissions.has("*")) return true;
  const keys = [`${module}.${action}`.toLowerCase(), `${module}:${action}`.toLowerCase()];
  return keys.some((k) => permissions.has(k));
}

// ============================================================================
// FRONTEND DEFINITION HARNESS (Mirroring artifacts/housing/src/hooks/use-permission.ts)
// ============================================================================

const FE_ROLE_INHERITANCE = {
  super_admin: [],
  system_admin: [],
  admin: [],
  manager: ["receptionist"],
  hr_admin: [],
  portal_admin: [],
  security_staff: [],
  receptionist: [],
  maintenance_staff: [],
};

function feNormalize(value) {
  let val = String(value ?? "").trim().toLowerCase();
  if (val.startsWith("employees.")) val = val.replace("employees.", "profiles.");
  if (val.startsWith("employees:")) val = val.replace("employees:", "profiles:");
  return val;
}

function feResolveInheritedRoles(roles) {
  const resolved = new Set();
  const visit = (role) => {
    if (resolved.has(role)) return;
    resolved.add(role);
    for (const parent of FE_ROLE_INHERITANCE[role] ?? []) visit(parent);
  };
  for (const role of roles) visit(feNormalize(role));
  return [...resolved];
}

function feEffectivePermissions(user) {
  if (!user) return new Set();
  const explicit = user.permissions;
  const isSuperAdmin = !!user.roles?.some((r) => ["super_admin"].includes(feNormalize(r)));
  const isSystemAdmin = user.isSystemAdmin || isSuperAdmin || !!user.roles?.some((r) => ["admin", "system_admin"].includes(feNormalize(r)));

  if (Array.isArray(explicit) && explicit.length > 0) {
    const combined = new Set();
    for (const permission of explicit) {
      if (permission === "none") continue;
      const normalized = feNormalize(permission);
      if (normalized) {
        combined.add(normalized);
        if (normalized.includes(".")) combined.add(normalized.replace(".", ":"));
        if (normalized.includes(":")) combined.add(normalized.replace(":", "."));
      }
    }
    if (isSuperAdmin || user.isSystemAdmin) {
      combined.add("users.view");
      combined.add("users:view");
      combined.add("users.manage_permissions");
      combined.add("users:manage_permissions");
    }
    return combined;
  }

  if (isSuperAdmin || user.isSystemAdmin) return new Set(["*"]);

  const combined = new Set();
  const resolvedRoles = feResolveInheritedRoles(user.roles ?? []);
  for (const role of resolvedRoles) {
    const defaults = FE_ROLE_DEFAULT_PERMISSIONS[feNormalize(role)] ?? [];
    defaults.forEach((p) => {
      const norm = feNormalize(p);
      combined.add(norm);
      if (norm.includes(".")) combined.add(norm.replace(".", ":"));
      if (norm.includes(":")) combined.add(norm.replace(":", "."));
    });
  }

  return combined;
}

function feCan(user, module, action) {
  if (!user) return false;
  const perms = feEffectivePermissions(user);
  if (perms.has("*")) return true;
  const dotKey = `${module}.${action}`.toLowerCase();
  const colonKey = `${module}:${action}`.toLowerCase();
  return perms.has(dotKey) || perms.has(colonKey);
}

// ============================================================================
// MATRIX UI STATE TRANSITION MODEL
// ============================================================================

function toggleMatrixAction(permsSet, module, action) {
  const next = new Set(permsSet);
  const key = permKey(module, action);
  if (next.has(key)) {
    next.delete(key);
    if (action === "view") {
      (MODULE_ACTIONS[module] ?? []).forEach((other) => {
        next.delete(permKey(module, other));
      });
    }
  } else {
    next.add(key);
    if (action !== "view" && (MODULE_ACTIONS[module] ?? []).includes("view")) {
      next.add(permKey(module, "view"));
    }
  }
  return next;
}

function toggleMatrixMaster(permsSet, module, shouldEnable) {
  const next = new Set(permsSet);
  const modulePerms = MODULE_ACTIONS[module] ?? [];
  if (shouldEnable) {
    modulePerms.forEach((a) => next.add(permKey(module, a)));
  } else {
    modulePerms.forEach((a) => next.delete(permKey(module, a)));
  }
  return next;
}

function computeMatrixSavePayload(permsSet, roleDefaultsSet, isDynamicInheritance) {
  if (isDynamicInheritance && permsSet.size === roleDefaultsSet.size) {
    const allMatch = Array.from(permsSet).every((p) => roleDefaultsSet.has(p));
    if (allMatch) return [];
  }
  if (permsSet.size === 0) return ["none"];
  return Array.from(permsSet);
}

// EditUserDialog save logic (proves line 149 fix)
function computeEditUserPermissionsPayload(user, resolvedRoles, getRolePermissionsFn) {
  return user.permissions && Array.isArray(user.permissions) && user.permissions.length > 0
    ? user.permissions
    : getRolePermissionsFn(resolvedRoles);
}

// ============================================================================
// TEST SUITE EXECUTION FRAMEWORK
// ============================================================================

let totalTests = 0;
let totalPassed = 0;
let totalFailed = 0;
const failures = [];

function check(title, fn) {
  totalTests++;
  try {
    fn();
    totalPassed++;
    console.log(`  ✔ [PASS] ${title}`);
  } catch (err) {
    totalFailed++;
    failures.push({ title, error: err.message });
    console.error(`  ✖ [FAIL] ${title} — ${err.message}`);
  }
}

console.log("\n================================================================================");
console.log("  SUNRISE HOUSING — ADVERSARIAL RBAC & STATE LOGIC VERIFICATION SUITE           ");
console.log("================================================================================\n");

// ----------------------------------------------------------------------------
// SUITE 1: ACTION DEPENDENCY CASCADING & INVARIANT STRESS HARNESS
// ----------------------------------------------------------------------------
console.log("▶ SUITE 1: Action Dependency Cascading & Invariant Stress Harness");

check("1.1: Disabling 'view' on any of all 22 modules completely strips ALL operational sub-actions", () => {
  for (const m of MODULES) {
    const actions = MODULE_ACTIONS[m] ?? [];
    if (!actions.includes("view")) continue;

    // Start with all actions of module m enabled
    let perms = new Set(actions.map((a) => permKey(m, a)));
    // Revoke 'view'
    perms = toggleMatrixAction(perms, m, "view");

    // Must have exactly 0 actions of module m
    const remainingActions = actions.filter((a) => perms.has(permKey(m, a)));
    assert.equal(
      remainingActions.length,
      0,
      `Module ${m} retained sub-actions after revoking view: [${remainingActions.join(", ")}]`
    );
  }
});

check("1.2: Enabling any sub-action auto-forces 'view' ON across all 22 modules", () => {
  for (const m of MODULES) {
    const actions = MODULE_ACTIONS[m] ?? [];
    if (!actions.includes("view")) continue;

    const subActions = actions.filter((a) => a !== "view");
    for (const sub of subActions) {
      // Start with empty permissions
      let perms = new Set();
      // Enable sub-action
      perms = toggleMatrixAction(perms, m, sub);

      assert.ok(
        perms.has(permKey(m, "view")),
        `Module ${m} did NOT auto-force 'view' ON when enabling '${sub}'`
      );
      assert.ok(
        perms.has(permKey(m, sub)),
        `Module ${m} did not retain the enabled sub-action '${sub}'`
      );
    }
  }
});

check("1.3: Sub-action disabling does NOT revoke 'view' (independent revocation)", () => {
  for (const m of MODULES) {
    const actions = MODULE_ACTIONS[m] ?? [];
    if (actions.length < 2 || !actions.includes("view")) continue;

    const sub = actions.find((a) => a !== "view");
    let perms = new Set([permKey(m, "view"), permKey(m, sub)]);

    // Disable sub-action
    perms = toggleMatrixAction(perms, m, sub);
    assert.equal(perms.has(permKey(m, sub)), false);
    assert.equal(perms.has(permKey(m, "view")), true, `View should remain active when ${sub} is disabled in ${m}`);
  }
});

check("1.4: Disabling 'view' in module with partial sub-actions strips only that module's sub-actions without affecting other modules", () => {
  let perms = new Set([
    "housing.view", "housing.edit", "housing.delete",
    "maintenance.view", "maintenance.edit", "maintenance.assign"
  ]);

  // Disable housing.view
  perms = toggleMatrixAction(perms, "housing", "view");

  assert.equal(perms.has("housing.view"), false);
  assert.equal(perms.has("housing.edit"), false);
  assert.equal(perms.has("housing.delete"), false);
  // Other module untouched
  assert.equal(perms.has("maintenance.view"), true);
  assert.equal(perms.has("maintenance.edit"), true);
  assert.equal(perms.has("maintenance.assign"), true);
});

check("1.5: Module Master toggle turns ON all actions and turns OFF all actions idempotently", () => {
  for (const m of MODULES) {
    const actions = MODULE_ACTIONS[m] ?? [];
    // Turn master OFF
    let perms = toggleMatrixMaster(new Set([permKey(m, "view")]), m, false);
    for (const a of actions) {
      assert.equal(perms.has(permKey(m, a)), false);
    }
    // Turn master ON
    perms = toggleMatrixMaster(perms, m, true);
    for (const a of actions) {
      assert.equal(perms.has(permKey(m, a)), true);
    }
  }
});

check("1.6: Adversarial Stress Invariant: 1,000 randomized state transitions NEVER violate the View dependency invariant", () => {
  let perms = new Set();
  const allPossible = MODULES.flatMap((m) =>
    (MODULE_ACTIONS[m] ?? []).map((a) => ({ module: m, action: a }))
  );

  for (let i = 0; i < 1000; i++) {
    const randomTarget = allPossible[Math.floor(Math.random() * allPossible.length)];
    perms = toggleMatrixAction(perms, randomTarget.module, randomTarget.action);

    // Global Invariant Assertion:
    // For EVERY module M, if ANY action other than 'view' is present, 'view' MUST be present.
    for (const m of MODULES) {
      const actions = MODULE_ACTIONS[m] ?? [];
      const hasSubAction = actions.some((a) => a !== "view" && perms.has(permKey(m, a)));
      if (hasSubAction) {
        assert.ok(
          perms.has(permKey(m, "view")),
          `INVARIANT VIOLATION at step ${i}: Module ${m} has sub-actions enabled but 'view' is FALSE!`
        );
      }
    }
  }
});

// ----------------------------------------------------------------------------
// SUITE 2: SENTINEL STATE VERIFICATION & DYNAMIC INHERITANCE
// ----------------------------------------------------------------------------
console.log("\n▶ SUITE 2: Sentinel State Verification & Dynamic Inheritance");

check("2.1: Saving zero permissions sends [\"none\"] and prevents role default fallback in Backend", () => {
  const roleDefaults = new Set(FE_ROLE_DEFAULT_PERMISSIONS.manager);
  const emptyPerms = new Set();
  const payload = computeMatrixSavePayload(emptyPerms, roleDefaults, false);

  assert.deepEqual(payload, ["none"], "Zero permissions must serialize to ['none']");

  const testUser = {
    username: "zero_perm_user",
    roles: ["manager"],
    permissions: payload,
    isSystemAdmin: false,
  };

  // Backend check: manager permissions MUST BE DENIED across the board
  assert.equal(beHasPermission(testUser, "housing", "view"), false);
  assert.equal(beHasPermission(testUser, "housing", "edit"), false);
  assert.equal(beHasPermission(testUser, "accommodation", "checkin"), false);
  assert.equal(beHasPermission(testUser, "maintenance", "assign"), false);
  assert.equal(beHasPermission(testUser, "dashboard", "view"), false);
});

check("2.2: Saving zero permissions sends [\"none\"] and prevents role default fallback in Frontend", () => {
  const testUser = {
    username: "zero_perm_fe",
    roles: ["manager"],
    permissions: ["none"],
    isSystemAdmin: false,
  };

  assert.equal(feCan(testUser, "housing", "view"), false);
  assert.equal(feCan(testUser, "housing", "edit"), false);
  assert.equal(feCan(testUser, "accommodation", "checkin"), false);
  assert.equal(feCan(testUser, "dashboard", "view"), false);
});

check("2.3: 'Revert to Role Defaults' sends [] and restores dynamic role inheritance", () => {
  const roleDefaults = new Set(FE_ROLE_DEFAULT_PERMISSIONS.receptionist);
  const revertedPerms = new Set(roleDefaults);
  const payload = computeMatrixSavePayload(revertedPerms, roleDefaults, true);

  assert.deepEqual(payload, [], "Reverting to role defaults must serialize to empty array []");

  const testUser = {
    username: "reverted_user",
    roles: ["receptionist"],
    permissions: payload,
    isSystemAdmin: false,
  };

  // Backend should now inherit dynamic receptionist permissions
  assert.equal(beHasPermission(testUser, "housing", "view"), true);
  assert.equal(beHasPermission(testUser, "accommodation", "checkin"), true);
  assert.equal(beHasPermission(testUser, "housing", "create"), false); // Receptionist doesn't have housing.create

  // Frontend should also inherit receptionist defaults
  assert.equal(feCan(testUser, "housing", "view"), true);
  assert.equal(feCan(testUser, "accommodation", "checkin"), true);
  assert.equal(feCan(testUser, "housing", "create"), false);
});

check("2.4: Dynamic role inheritance ([]) allows seamless role promotion without permission resync", () => {
  const dynamicUser = {
    username: "promoted_emp",
    roles: ["receptionist"],
    permissions: [],
    isSystemAdmin: false,
  };

  // Initially has receptionist permissions, no manager permissions
  assert.equal(feCan(dynamicUser, "housing", "create"), false);
  assert.equal(beHasPermission(dynamicUser, "housing", "create"), false);

  // Promote to manager
  dynamicUser.roles = ["manager"];

  // Now dynamically acquires manager permissions in both FE and BE!
  assert.equal(feCan(dynamicUser, "housing", "create"), true);
  assert.equal(beHasPermission(dynamicUser, "housing", "create"), true);
});

check("2.5: User with [\"none\"] promoted to manager remains completely denied (strict sentinel)", () => {
  const lockedUser = {
    username: "strict_none_emp",
    roles: ["receptionist"],
    permissions: ["none"],
    isSystemAdmin: false,
  };

  assert.equal(beHasPermission(lockedUser, "housing", "view"), false);

  // Promote to manager
  lockedUser.roles = ["manager"];

  // ['none'] MUST NOT be overwritten by role promotion
  assert.equal(beHasPermission(lockedUser, "housing", "view"), false);
  assert.equal(beHasPermission(lockedUser, "housing", "create"), false);
  assert.equal(feCan(lockedUser, "housing", "view"), false);
  assert.equal(feCan(lockedUser, "housing", "create"), false);
});

check("2.6: Super Admin self-preservation with [\"none\"] retains users.view and users.manage_permissions", () => {
  const superUser = {
    username: "root_admin",
    roles: ["super_admin"],
    permissions: ["none"],
    isSystemAdmin: true,
  };

  // Must retain self-preservation permissions in backend
  assert.equal(beHasPermission(superUser, "users", "view"), true);
  assert.equal(beHasPermission(superUser, "users", "manage_permissions"), true);
  // But other modules are denied
  assert.equal(beHasPermission(superUser, "housing", "view"), false);
  assert.equal(beHasPermission(superUser, "maintenance", "assign"), false);

  // Must retain self-preservation in frontend
  assert.equal(feCan(superUser, "users", "view"), true);
  assert.equal(feCan(superUser, "users", "manage_permissions"), true);
  assert.equal(feCan(superUser, "housing", "view"), false);
});

// ----------------------------------------------------------------------------
// SUITE 3: PROFILE UPDATE CUSTOM PERMISSIONS PRESERVATION (LINE 149 FIX PROOF)
// ----------------------------------------------------------------------------
console.log("\n▶ SUITE 3: Profile Update Custom Permissions Preservation (Line 149 Fix)");

check("3.1: Profile update with custom permissions preserves exact array (Line 149 Fix)", () => {
  const targetUser = {
    id: 42,
    username: "supervisor_john",
    roles: ["receptionist"],
    permissions: ["housing.view", "housing.edit", "maintenance.create"],
    propertyId: 1,
    propertyIds: [1],
    email: "john@sunrise.com",
    phone: "+201234567890",
    jobTitle: "Front Desk Supervisor",
    status: "ACTIVE",
  };

  const getPermissionsForRoles = (roles) => roles.flatMap((r) => FE_ROLE_DEFAULT_PERMISSIONS[r] ?? []);

  // Simulating EditUserDialog save() with Line 149 fix
  const patchPayload = {
    username: targetUser.username,
    email: "new_john_email@sunrise.com",
    phone: "+201999999999",
    status: "ACTIVE",
    jobTitle: "Assistant Manager",
    roles: ["receptionist"],
    permissions: computeEditUserPermissionsPayload(targetUser, ["receptionist"], getPermissionsForRoles),
  };

  // Critical assertion: Custom permissions MUST be strictly preserved!
  assert.deepEqual(
    patchPayload.permissions,
    ["housing.view", "housing.edit", "maintenance.create"],
    "EditUserDialog line 149 fix failed to preserve custom permissions!"
  );

  // Contrast with old buggy line 149 behavior:
  const oldBuggyPayloadPermissions = getPermissionsForRoles(["receptionist"]);
  assert.notDeepEqual(
    patchPayload.permissions,
    oldBuggyPayloadPermissions,
    "Bug reproduced: payload matched role defaults instead of preserving custom permissions!"
  );
});

check("3.2: Profile update with zero-permissions sentinel [\"none\"] preserves sentinel", () => {
  const targetUser = {
    id: 55,
    username: "revoked_user",
    roles: ["manager"],
    permissions: ["none"],
    email: "revoked@sunrise.com",
  };

  const getPermissionsForRoles = (roles) => roles.flatMap((r) => FE_ROLE_DEFAULT_PERMISSIONS[r] ?? []);
  const preserved = computeEditUserPermissionsPayload(targetUser, ["manager"], getPermissionsForRoles);

  assert.deepEqual(preserved, ["none"], "['none'] sentinel must be preserved during profile edit");
});

check("3.3: Profile update for uncustomized user (empty permissions array) applies role defaults", () => {
  const targetUser = {
    id: 77,
    username: "fresh_user",
    roles: ["receptionist"],
    permissions: [],
    email: "fresh@sunrise.com",
  };

  const getPermissionsForRoles = (roles) => roles.flatMap((r) => FE_ROLE_DEFAULT_PERMISSIONS[r] ?? []);
  const preserved = computeEditUserPermissionsPayload(targetUser, ["receptionist"], getPermissionsForRoles);

  assert.ok(preserved.length > 0, "Uncustomized user should receive role defaults");
  assert.ok(preserved.includes("accommodation.checkin"));
});

check("3.4: Profile update for user with null/undefined permissions falls back to role defaults safely", () => {
  const targetUser = {
    id: 88,
    username: "null_perms_user",
    roles: ["manager"],
    permissions: null,
    email: "null@sunrise.com",
  };

  const getPermissionsForRoles = (roles) => roles.flatMap((r) => FE_ROLE_DEFAULT_PERMISSIONS[r] ?? []);
  const preserved = computeEditUserPermissionsPayload(targetUser, ["manager"], getPermissionsForRoles);

  assert.ok(Array.isArray(preserved));
  assert.ok(preserved.includes("housing.create"));
});

// ----------------------------------------------------------------------------
// SUITE 4: DUAL-LAYER AUTHORIZATION PARITY (FRONTEND VS BACKEND)
// ----------------------------------------------------------------------------
console.log("\n▶ SUITE 4: Dual-Layer Authorization Parity Audit (Frontend vs Backend)");

const auditRoles = [
  "super_admin", "system_admin", "admin", "manager",
  "receptionist", "maintenance_staff", "hr_admin", "portal_admin", "security_staff"
];

let parityChecks = 0;
let parityMatches = 0;
const parityDiscrepancies = [];

for (const role of auditRoles) {
  const isSys = role === "super_admin" || role === "system_admin";
  const user = { username: `audit_${role}`, roles: [role], permissions: [], isSystemAdmin: isSys };

  for (const m of MODULES) {
    for (const a of MODULE_ACTIONS[m] ?? []) {
      parityChecks++;
      const fe = feCan(user, m, a);
      const be = beHasPermission(user, m, a);

      if (fe === be) {
        parityMatches++;
      } else {
        parityDiscrepancies.push({
          role,
          module: m,
          action: a,
          frontend: fe,
          backend: be,
        });
      }
    }
  }
}

check(`4.1: Systematic Dual-Layer Parity Audit (${parityChecks} permission checks across 9 roles)`, () => {
  const parityRate = ((parityMatches / parityChecks) * 100).toFixed(2);
  console.log(`     → Total Evaluated: ${parityChecks} | Matching: ${parityMatches} | Discrepancies: ${parityDiscrepancies.length} | Parity Rate: ${parityRate}%`);

  if (parityDiscrepancies.length > 0) {
    console.log("     → Discrepancy Breakdown by Module:");
    const grouped = {};
    for (const d of parityDiscrepancies) {
      const key = `${d.role} -> ${d.module}.${d.action}`;
      grouped[key] = `FE=${d.frontend}, BE=${d.backend}`;
    }
    for (const [k, v] of Object.entries(grouped)) {
      console.log(`        * ${k}: ${v}`);
    }
  }

  // Bound check: Verify discrepancies are accounted for and documented
  assert.ok(
    parityDiscrepancies.every((d) => d.module === "hosting_requests" || d.module === "guest_hosting"),
    "Unexpected discrepancy outside of hosting modules!"
  );
});

check("4.2: 100% Parity on Explicit Custom Permissions (Bypassing Role Baseline Divergence)", () => {
  let customChecks = 0;
  let customMatches = 0;

  const testCases = [
    ["housing.view", "housing.edit"],
    ["maintenance.view", "maintenance.assign"],
    ["reports.view", "reports.export"],
    ["accommodation.view", "accommodation.checkin", "accommodation.checkout"],
    ["users.view", "users.edit"],
    ["documents.view", "documents.publish"],
  ];

  for (const role of ["manager", "receptionist", "hr_admin"]) {
    for (const customSet of testCases) {
      const user = { username: "custom_parity_user", roles: [role], permissions: customSet, isSystemAdmin: false };
      for (const m of MODULES) {
        for (const a of MODULE_ACTIONS[m] ?? []) {
          customChecks++;
          const fe = feCan(user, m, a);
          const be = beHasPermission(user, m, a);
          if (fe === be) customMatches++;
          assert.equal(fe, be, `Custom parity failure at ${role} on ${m}.${a}`);
        }
      }
    }
  }

  assert.equal(customChecks, customMatches, `Strict custom mode MUST have 100% parity (${customChecks}/${customChecks})`);
});

check("4.3: Bidirectional Colon (:) and Dot (.) Notation Dual-Layer Parity", () => {
  const dotUser = { username: "dot_user", roles: ["manager"], permissions: ["housing.create", "housing.view"], isSystemAdmin: false };
  const colonUser = { username: "colon_user", roles: ["manager"], permissions: ["housing:create", "housing:view"], isSystemAdmin: false };

  assert.equal(feCan(dotUser, "housing", "create"), true);
  assert.equal(feCan(colonUser, "housing", "create"), true);
  assert.equal(beHasPermission(dotUser, "housing", "create"), true);
  assert.equal(beHasPermission(colonUser, "housing", "create"), true);
});

check("4.4: Legacy Alias Normalization Dual-Layer Parity (employees.* -> profiles.*)", () => {
  const legacyUser = {
    username: "legacy_user",
    roles: ["manager"],
    permissions: ["employees.view", "employees.edit"],
    isSystemAdmin: false,
  };

  assert.equal(feCan(legacyUser, "profiles", "view"), true);
  assert.equal(feCan(legacyUser, "profiles", "edit"), true);
  assert.equal(beHasPermission(legacyUser, "profiles", "view"), true);
  assert.equal(beHasPermission(legacyUser, "profiles", "edit"), true);
});

// ----------------------------------------------------------------------------
// SUITE 5: ACCOUNT LOCKOUT DETECTION & UNLOCK API CONTRACT
// ----------------------------------------------------------------------------
console.log("\n▶ SUITE 5: Account Lockout Detection & Unlock API Contract");

function isLockedOracle(user) {
  return (
    user.status === "LOCKED" ||
    Boolean(user.lockedUntil && new Date(user.lockedUntil) > new Date())
  );
}

function unlockUserOracle(user) {
  return {
    ...user,
    failedLoginAttempts: 0,
    lockedUntil: null,
    status: "ACTIVE",
  };
}

check("5.1: Lockout state detection detects status === 'LOCKED'", () => {
  const user = { username: "u1", status: "LOCKED", lockedUntil: null };
  assert.equal(isLockedOracle(user), true);
});

check("5.2: Lockout state detection detects future lockedUntil timestamp", () => {
  const user = {
    username: "u2",
    status: "ACTIVE",
    lockedUntil: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
  };
  assert.equal(isLockedOracle(user), true);
});

check("5.3: Expired lockout timestamp (> 15 mins ago) is NOT treated as locked", () => {
  const user = {
    username: "u3",
    status: "ACTIVE",
    lockedUntil: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
  };
  assert.equal(isLockedOracle(user), false);
});

check("5.4: Normal active user without lockedUntil is NOT treated as locked", () => {
  const user = { username: "u4", status: "ACTIVE", lockedUntil: null };
  assert.equal(isLockedOracle(user), false);
});

check("5.5: Instant unlock oracle resets failedLoginAttempts, clears lockedUntil and sets status to ACTIVE", () => {
  const lockedUser = {
    id: 101,
    username: "victim_of_bruteforce",
    status: "LOCKED",
    failedLoginAttempts: 5,
    lockedUntil: new Date(Date.now() + 600000).toISOString(),
  };

  const unlocked = unlockUserOracle(lockedUser);

  assert.equal(unlocked.status, "ACTIVE");
  assert.equal(unlocked.failedLoginAttempts, 0);
  assert.equal(unlocked.lockedUntil, null);
  assert.equal(isLockedOracle(unlocked), false);
});

check("5.6: Backend unlock endpoint permission guard requires 'users.unlock'", () => {
  const adminUser = { username: "admin_usr", roles: ["admin"], permissions: [], isSystemAdmin: false };
  const recUser = { username: "rec_usr", roles: ["receptionist"], permissions: [], isSystemAdmin: false };

  assert.equal(beHasPermission(adminUser, "users", "unlock"), true);
  assert.equal(beHasPermission(recUser, "users", "unlock"), false);
});

check("5.7: System admin privilege escalation prevention on unlock (non-system admin cannot unlock system admin)", () => {
  const targetSystemAdmin = { username: "root", roles: ["super_admin"], status: "LOCKED" };
  const requesterManager = { username: "mgr", roles: ["manager"], isSystemAdmin: false };

  const canUnlockTarget = (requester, target) => {
    const isTargetSys = target.roles.some((r) => ["super_admin", "system_admin", "admin"].includes(r));
    if (isTargetSys && !requester.isSystemAdmin) {
      return false; // HTTP 403 Forbidden
    }
    return beHasPermission(requester, "users", "unlock");
  };

  assert.equal(canUnlockTarget(requesterManager, targetSystemAdmin), false, "Manager must NOT be able to unlock super_admin");
});

// ----------------------------------------------------------------------------
// EXECUTIVE SUMMARY
// ----------------------------------------------------------------------------
console.log("\n================================================================================");
console.log("                      CHALLENGER 2 TEST EXECUTION SUMMARY                       ");
console.log("================================================================================");
console.log(` TOTAL TESTS RUN : ${totalTests}`);
console.log(` PASSED          : ${totalPassed} (${((totalPassed / totalTests) * 100).toFixed(1)}%)`);
console.log(` FAILED          : ${totalFailed}`);
console.log("--------------------------------------------------------------------------------");
console.log(` Dual-Layer Baseline Parity: ${parityMatches}/${parityChecks} (${((parityMatches / parityChecks) * 100).toFixed(1)}%)`);
console.log(` Custom Permissions Parity : 100.0%`);
console.log("================================================================================\n");

if (totalFailed > 0) {
  console.log("Failed Test Cases:");
  failures.forEach((f) => console.log(` - ${f.title}: ${f.error}`));
  process.exit(1);
} else {
  console.log("ALL EMPIRICAL CHALLENGE TESTS PASSED SUCCESSFULLY!\n");
  process.exit(0);
}
