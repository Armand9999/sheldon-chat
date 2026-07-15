import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  // Local dev only — avoids parent lockfile warning; omit on Amplify Linux builds.
  ...(process.env.NODE_ENV === "development"
    ? { turbopack: { root: path.join(__dirname) } }
    : {}),
  experimental: {
    serverActions: {
      bodySizeLimit: "20mb",
    },
  },
};

export default nextConfig;
