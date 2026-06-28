/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack(config) {
    // wagmi v3 bundles all connectors which have optional peer deps we don't use.
    // Stub them out so the build doesn't fail.
    config.resolve.alias = {
      ...config.resolve.alias,
      "@base-org/account":               false,
      "@metamask/connect-evm":           false,
      "@safe-global/safe-apps-sdk":      false,
      "@safe-global/safe-apps-provider": false,
      "accounts":                        false,
    };
    return config;
  },
};

export default nextConfig;
