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
};

export default nextConfig;
