import type { NextConfig } from "next";

const configuredBackend = process.env.BACKEND_URL;
const privateHostPort = process.env.BACKEND_HOSTPORT;
const backendUrl = configuredBackend
  ? configuredBackend.replace(/\/$/, "")
  : privateHostPort
    ? `http://${privateHostPort}`
    : "http://localhost:8000";

const nextConfig: NextConfig = {
  output: "standalone",
  poweredByHeader: false,
  async rewrites() {
    return [
      { source: "/api/:path*", destination: `${backendUrl}/api/:path*` },
      { source: "/health", destination: `${backendUrl}/health` },
      { source: "/ready", destination: `${backendUrl}/ready` }
    ];
  }
};

export default nextConfig;
