import { beforeEach, describe, expect, it, vi } from "vitest";

const { customFetch } = vi.hoisted(() => ({
  customFetch: vi.fn<(url: string) => Promise<unknown>>(),
}));
vi.mock("@workspace/api-client-react", () => ({ customFetch }));

import { fetchAllPages } from "../fetch-all-pages";

/** Fake paginated endpoint over `total` rows with ids 1..total. */
function servePages(total: number, cap = Infinity) {
  customFetch.mockImplementation(async (url: string) => {
    const qs = new URLSearchParams(url.split("?")[1]);
    const page = Number(qs.get("page"));
    const limit = Math.min(Number(qs.get("limit")), cap);
    const start = (page - 1) * limit;
    const data = Array.from(
      { length: Math.max(0, Math.min(limit, total - start)) },
      (_, i) => ({ id: start + i + 1 }),
    );
    return { data, pagination: { page, limit, total } };
  });
}

describe("fetchAllPages", () => {
  beforeEach(() => {
    customFetch.mockReset();
  });

  it("returns every row across pages, in order", async () => {
    servePages(2503);
    const rows = await fetchAllPages("/api/rooms", { propertyId: 1 }, 1000);
    expect(rows).toHaveLength(2503);
    expect(rows.map((r: any) => r.id)).toEqual(
      Array.from({ length: 2503 }, (_, i) => i + 1),
    );
    expect(customFetch).toHaveBeenCalledTimes(3);
  });

  it("makes one request when the first page holds everything", async () => {
    servePages(40);
    const rows = await fetchAllPages("/api/rooms", { propertyId: 1 }, 1000);
    expect(rows).toHaveLength(40);
    expect(customFetch).toHaveBeenCalledTimes(1);
  });

  it("passes params and skips empty ones", async () => {
    servePages(1);
    await fetchAllPages(
      "/api/profiles",
      { propertyId: 7, search: "", status: undefined },
      100,
    );
    expect(customFetch).toHaveBeenCalledWith(
      "/api/profiles?propertyId=7&page=1&limit=100",
    );
  });

  it("drops a row duplicated across pages by a concurrent insert", async () => {
    customFetch.mockImplementation(async (url: string) => {
      const page = Number(new URLSearchParams(url.split("?")[1]).get("page"));
      return page === 1
        ? { data: [{ id: 3 }, { id: 2 }], pagination: { total: 4 } }
        : { data: [{ id: 2 }, { id: 1 }], pagination: { total: 4 } };
    });
    const rows = await fetchAllPages("/api/x", {}, 2);
    expect(rows.map((r: any) => r.id)).toEqual([3, 2, 1]);
  });

  it("returns an unpaginated array response as is", async () => {
    customFetch.mockResolvedValue([{ id: 1 }, { id: 2 }]);
    const rows = await fetchAllPages("/api/assignments", {}, 1);
    expect(rows).toHaveLength(2);
    expect(customFetch).toHaveBeenCalledTimes(1);
  });
});
