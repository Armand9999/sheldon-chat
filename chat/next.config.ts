import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  // Local dev only — avoids parent lockfile warning; omit on Amplify Linux builds.
  ...(process.env.NODE_ENV === "development"
    ? { turbopack: { root: path.join(__dirname) } }
    : {}),
  // Prevent Amplify SSR from breaking when bundling the AWS SDK.
  serverExternalPackages: [
    "@aws-sdk/client-s3",
    "@aws-sdk/client-cognito-identity-provider",
  ],
  experimental: {
    serverActions: {
      bodySizeLimit: "20mb",
    },
  },
};

export default nextConfig;
