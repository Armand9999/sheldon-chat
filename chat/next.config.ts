import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  // Local dev only — avoids parent lockfile warning; omit on Amplify Linux builds.
  ...(process.env.NODE_ENV === "development"
    ? { turbopack: { root: path.join(__dirname) } }
    : {}),
  // S3 SDK breaks Amplify SSR when bundled; Cognito must stay bundled
  // (externalizing it caused /api/auth/sign-in to return plain-text 500).
  serverExternalPackages: ["@aws-sdk/client-s3"],
  experimental: {
    serverActions: {
      bodySizeLimit: "20mb",
    },
  },
};

export default nextConfig;
