import type { NextConfig } from "next";

const isStaticPreview = process.env.STATIC_PREVIEW === "true";

const nextConfig: NextConfig = isStaticPreview
  ? {
      output: "export",
      basePath: "/RESON-music",
      images: { unoptimized: true },
    }
  : {
      serverExternalPackages: ["stripe"],
    };

export default nextConfig;
