import type { NextConfig } from "next";
import { baselineSecurityHeaders } from "./src/server/security-headers";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: [...baselineSecurityHeaders] }];
  },
  turbopack: {
    root: process.cwd(),
  },
};

export default nextConfig;
