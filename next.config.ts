import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Keep `pg` out of the webpack graph. TypeORM 1.1 loads drivers with a
  // dynamic require(), which Next.js cannot bundle; we pass `pg` in explicitly.
  serverExternalPackages: ["pg"],
};

export default nextConfig;
