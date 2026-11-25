import { describe, it, expect, vi, beforeEach } from "vitest";
import nodemailer from "nodemailer";

// Mock DNS so the factory's IPv4 resolution is deterministic.
vi.mock("node:dns/promises", () => ({ lookup: vi.fn() }));
import { lookup } from "node:dns/promises";

import { createTransporter, describeSmtpError } from "../email-service";

const lookupMock = vi.mocked(lookup);

describe("createTransporter — force IPv4", () => {
  let createSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    // Restore the original createTransport first: re-spying an already-spied
    // method keeps accumulated call history under Vitest 4.
    vi.restoreAllMocks();
    lookupMock.mockReset();
    createSpy = vi
      .spyOn(nodemailer, "createTransport")
      .mockReturnValue({} as any);
  });

  it("resolves a hostname to IPv4 and keeps the hostname as tls.servername", async () => {
    lookupMock.mockResolvedValue({ address: "1.2.3.4", family: 4 } as any);

    await createTransporter({
      smtpHost: "smtp.office365.com",
      smtpPort: 587,
      smtpUser: "u@x.com",
      smtpPass: "p",
    });

    expect(lookupMock).toHaveBeenCalledWith("smtp.office365.com", {
      family: 4,
    });
    const opts = createSpy.mock.calls[0][0] as any;
    expect(opts.host).toBe("1.2.3.4");
    expect(opts.tls.servername).toBe("smtp.office365.com");
    expect(opts.tls.rejectUnauthorized).toBe(true);
  });

  it("uses an IP-literal host as-is and does not resolve DNS", async () => {
    await createTransporter({
      smtpHost: "10.0.0.5",
      smtpPort: 587,
      smtpUser: "u@x.com",
      smtpPass: "p",
    });

    expect(lookupMock).not.toHaveBeenCalled();
    const opts = createSpy.mock.calls[0][0] as any;
    expect(opts.host).toBe("10.0.0.5");
    expect(opts.tls.servername).toBeUndefined();
  });

  it("throws a clear error when the host has no IPv4 address", async () => {
    lookupMock.mockRejectedValue(
      Object.assign(new Error("no record"), { code: "ENOTFOUND" }),
    );

    await expect(
      createTransporter({
        smtpHost: "smtp.office365.com",
        smtpPort: 587,
        smtpUser: "u@x.com",
        smtpPass: "p",
      }),
    ).rejects.toThrow(/SMTP host has no IPv4 address: smtp\.office365\.com/);
    expect(createSpy).not.toHaveBeenCalled();
  });
});

describe("describeSmtpError", () => {
  it("maps unreachable-network errors", () => {
    expect(describeSmtpError({ code: "ENETUNREACH" })).toMatch(
      /Cannot reach SMTP server/,
    );
    expect(describeSmtpError({ code: "ECONNREFUSED" })).toMatch(
      /Cannot reach SMTP server/,
    );
    expect(
      describeSmtpError(new Error("SMTP send timed out after 15000ms")),
    ).toMatch(/Cannot reach SMTP server/);
  });

  it("maps authentication errors", () => {
    expect(describeSmtpError({ code: "EAUTH", responseCode: 535 })).toMatch(
      /authentication failed/i,
    );
  });

  it("passes the no-IPv4 message through", () => {
    expect(
      describeSmtpError(new Error("SMTP host has no IPv4 address: a.b.c")),
    ).toMatch(/no IPv4 address/i);
  });
});
