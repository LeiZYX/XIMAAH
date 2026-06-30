import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  async redirects() {
    return [
      {
        source: "/admin/students",
        destination: "/admin/users/students",
        permanent: false,
      },
      {
        source: "/exam-office/students",
        destination: "/exam-office/candidates",
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
