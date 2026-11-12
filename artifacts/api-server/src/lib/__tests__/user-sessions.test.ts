import { describe, expect, it, vi } from "vitest";

vi.mock("@workspace/db", () => ({ pool: { query: vi.fn() } }));

const { describeDevice, publicSessionId } = await import("../user-sessions");

describe("describeDevice", () => {
  it("names common browsers and systems", () => {
    expect(
      describeDevice(
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36",
      ),
    ).toBe("Chrome · Windows");
    expect(
      describeDevice(
        "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile/15E148 Safari/604.1",
      ),
    ).toBe("Safari · iPhone");
    expect(
      describeDevice(
        "Mozilla/5.0 (Windows NT 10.0) Chrome/130.0 Safari/537.36 Edg/130.0",
      ),
    ).toBe("Edge · Windows");
    expect(describeDevice("okhttp/4.9 (Android 14)")).toBe("App · Android");
    expect(describeDevice("")).toBe("Unknown device");
  });
});

describe("publicSessionId", () => {
  it("is a stable 16-char hash that does not contain the id", () => {
    const a = publicSessionId("abc123secret");
    expect(a).toMatch(/^[a-f0-9]{16}$/);
    expect(a).toBe(publicSessionId("abc123secret"));
    expect(a).not.toContain("abc123");
  });
});
