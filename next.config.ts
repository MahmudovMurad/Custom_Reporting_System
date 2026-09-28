import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // PGlite (lokal DB) WASM fayllarını öz qovluğundan oxuyur — bundle-a salınmamalıdır
  serverExternalPackages: ["@electric-sql/pglite"],
  poweredByHeader: false,
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
