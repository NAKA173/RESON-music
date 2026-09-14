import type { NextConfig } from "next";

const isStaticPreview = process.env.STATIC_PREVIEW === "true";

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), geolocation=(), microphone=()" },
];

const headers: NextConfig["headers"] = async () => [
  { source: "/:path*", headers: securityHeaders },
];

const nextConfig: NextConfig = isStaticPreview
  ? {
      output: "export",
      basePath: "/RESON-music",
      images: { unoptimized: true },
      headers,
    }
  : {
      serverExternalPackages: ["stripe"],
      headers,
    };

export default nextConfig;
