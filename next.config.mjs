/** @type {import('next').NextConfig} */
const nextConfig = {
  // Allow Vercel Blob URLs for images
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.public.blob.vercel-storage.com",
      },
    ],
  },
  // Transpile Three.js packages for proper bundling
  transpilePackages: ["three"],
};

export default nextConfig;
