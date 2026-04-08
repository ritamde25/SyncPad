import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",
  allowedDevOrigins: ["localhost", "127.0.0.1", "192.168.0.3"],
  turbopack: {
    root: __dirname,
  },
};

export default nextConfig;
