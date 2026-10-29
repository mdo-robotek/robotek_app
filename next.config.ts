import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  compress: true,
  experimental: {
    // The login lock (Oct 26) runs the middleware on /api too. Next keeps a
    // copy of each request body for the middleware and, by default, cuts it
    // at 10 MB — which would silently break larger chat videos and
    // attachments. Raise it so uploads behave exactly as before.
    proxyClientMaxBodySize: "100mb",
  },
  typescript: {
    // !! WARN !!
    // Dangerously allow production builds to successfully complete even if
    // your project has type errors.
    // !! WARN !!
    ignoreBuildErrors: true,
  },

  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'docs.google.com',
      },
      {
        protocol: 'https',
        hostname: 'drive.google.com',
      },
      {
        protocol: 'https',
        hostname: 'lh3.googleusercontent.com',
      }
    ],
  },
};

export default nextConfig;
