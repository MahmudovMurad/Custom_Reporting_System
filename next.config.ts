import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // PGlite (lokal DB) WASM fayllarını öz qovluğundan oxuyur — bundle-a salınmamalıdır
  serverExternalPackages: ["@electric-sql/pglite"],
  poweredByHeader: false,
  // www.srhesabat.com → srhesabat.com (vercel.app ünvanı yönləndirilmir: Apps Script /api/ingest-ə oradan POST edir)
  async redirects() {
    return [{ source: "/:path*", has: [{ type: "host", value: "www.srhesabat.com" }], destination: "https://srhesabat.com/:path*", permanent: true }];
  },
  async headers() {
    return [{
      source: "/:path*",
      headers: [
        { key: "X-Frame-Options", value: "DENY" },
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "Referrer-Policy", value: "same-origin" },
      ],
    }];
  },
};

export default nextConfig;
