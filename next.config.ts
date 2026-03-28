import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  webpack: (config, { dev }) => {
    if (dev) {
      config.watchOptions = {
        ...config.watchOptions,
        poll: 1000,
        aggregateTimeout: 300,
        ignored: [
          "**/.git/**",
          "**/.next/**",
          "**/node_modules/**",
          "**/.worktrees/**",
          "**/python-service/.venv/**",
          "**/python-service/__pycache__/**",
          "**/.playwright-cli/**",
          "**/public/uploads/**",
        ],
      };
    }

    return config;
  },
};

export default nextConfig;
