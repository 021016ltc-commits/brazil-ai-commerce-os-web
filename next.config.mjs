/** @type {import('next').NextConfig} */
const nextConfig = {
  outputFileTracingIncludes: {
    "/*": ["./data/brazil_ai_commerce_os.db"],
  },
};

export default nextConfig;
