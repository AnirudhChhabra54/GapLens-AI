/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    serverComponentsExternalPackages: ["unpdf"],
    serverActions: {
      bodySizeLimit: "2mb",
    },
  },
};

export default nextConfig;
