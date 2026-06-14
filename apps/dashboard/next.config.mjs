/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // The dashboard is a fully client-rendered thin client over Firestore, so we ship it as a
  // static export to classic Firebase Hosting — no SSR, no Cloud Run, no Blaze requirement.
  output: "export",
  images: { unoptimized: true },
};

export default nextConfig;
