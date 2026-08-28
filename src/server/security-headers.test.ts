import { describe, expect, it } from "vitest";

import { baselineSecurityHeaders } from "@/server/security-headers";

describe("baseline security headers", () => {
  it("blocks framing, content sniffing, referrer leakage, and unused permissions without CSP or HSTS", () => {
    expect(baselineSecurityHeaders).toEqual(expect.arrayContaining([
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "X-Frame-Options", value: "DENY" },
      { key: "Referrer-Policy", value: "no-referrer" },
      { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()" },
    ]));
    expect(baselineSecurityHeaders.map((header) => header.key)).not.toContain("Content-Security-Policy");
    expect(baselineSecurityHeaders.map((header) => header.key)).not.toContain("Strict-Transport-Security");
  });
});
