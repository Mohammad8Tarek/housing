import { describe, expect, it } from "vitest";
import { PgDialect, integer, pgTable } from "drizzle-orm/pg-core";
import { reportPropertyCondition } from "../report-property-scope";

const t = pgTable("t", { propertyId: integer("property_id") });
const dialect = new PgDialect();
const render = (c: any) => {
  if (!c) return undefined;
  const { sql, params } = dialect.sqlToQuery(c);
  return { sql, params };
};

const req = (propertyId: unknown, authUser: unknown) =>
  ({ query: { propertyId }, authUser }) as any;
const scoped = { roles: ["manager"], propertyIds: [2, 7] };

describe("reportPropertyCondition", () => {
  it("limits 'all' to the user's properties", () => {
    for (const all of ["all", "0", "-1", undefined]) {
      expect(
        render(reportPropertyCondition(req(all, scoped), t.propertyId)),
      ).toEqual({ sql: '"t"."property_id" in ($1, $2)', params: [2, 7] });
    }
  });

  it("returns no rows for a user without properties", () => {
    const q = render(
      reportPropertyCondition(
        req("all", { roles: ["manager"], propertyIds: [] }),
        t.propertyId,
      ),
    );
    expect(q?.sql).toBe("false");
  });

  it("does not restrict system admins asking for all", () => {
    for (const admin of [
      { isSystemAdmin: true, propertyIds: [] },
      { roles: ["super_admin"], propertyIds: [] },
    ]) {
      expect(
        reportPropertyCondition(req("all", admin), t.propertyId),
      ).toBeUndefined();
    }
  });

  it("filters to a single requested property", () => {
    expect(
      render(reportPropertyCondition(req("2", scoped), t.propertyId)),
    ).toEqual({ sql: '"t"."property_id" in ($1)', params: [2] });
  });
});
