import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",
  allowedDevOrigins: ["http://localhost:3000", "http://127.0.0.1:3000", "http://192.168.0.5:3000"],
  turbopack: {
    root: __dirname,
  },
};

export default nextConfig;
