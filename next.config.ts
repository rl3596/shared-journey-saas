import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // Whitelist remote hosts whose images we render through next/image.
    // Supabase Storage is the production source; picsum.photos is used only
    // by the local mock data fallback when SUPABASE_URL isn't configured.
    remotePatterns: [
      { protocol: "https", hostname: "*.supabase.co" },
      { protocol: "https", hostname: "picsum.photos" },
    ],
  },
  experimental: {
    serverActions: {
      // Avatar/background uploads go through Server Actions, whose request body
      // defaults to 1MB. A photo shrunk to 2048px easily exceeds that, which
      // surfaced as "an unexpected response was received from the server".
      // 4mb fits the shrunk images while staying under Vercel's 4.5MB cap.
      bodySizeLimit: "4mb",
    },
  },
};

export default nextConfig;
