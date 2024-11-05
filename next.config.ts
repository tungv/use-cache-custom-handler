import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  experimental: {
    dynamicIO: true,
    cacheHandlers: {
      default: require.resolve("./cache/default.js"),
      remote: require.resolve("./cache/remote.js"),
      static: require.resolve("./cache/static.js"),
    },
  },
  cacheMaxMemorySize: 0,
};

export default nextConfig;
