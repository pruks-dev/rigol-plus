import type { NextConfig } from "next";

const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";

const nextConfig: NextConfig = {
  output: "export",
  basePath,                         // set NEXT_PUBLIC_BASE_PATH=/RigolPlus for deploy
  images: { unoptimized: true },
  trailingSlash: true,
};

export default nextConfig;
