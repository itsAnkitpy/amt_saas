import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Pin the workspace root: a stray lockfile in a parent dir otherwise makes
  // Turbopack treat the whole home directory as the project root.
  turbopack: {
    root: __dirname,
  },
};

export default nextConfig;
