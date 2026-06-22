/** @type {import('next').NextConfig} */
const nextConfig = {
  reactCompiler: true,
  // Note: Firebase Storage CORS is configured on the bucket, not here.
  // See STORAGE_CORS_SETUP.md for setup instructions.
};

export default nextConfig;
