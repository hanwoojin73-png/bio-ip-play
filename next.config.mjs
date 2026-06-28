/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack(config) {
    // wagmi v3 bundles connectors whose optional peer deps we don't use.
    // Stub them so webpack doesn't fail trying to resolve them.
    config.resolve.alias = {
      ...config.resolve.alias,
      "@base-org/account":               false,
      "@metamask/connect-evm":           false,
      "@safe-global/safe-apps-sdk":      false,
      "@safe-global/safe-apps-provider": false,
      "accounts":                        false,
    };

    // viem / wagmi use pino for logging; pino-pretty is dev-only
    config.externals.push("pino-pretty", "lokijs", "encoding");

    return config;
  },
};

export default nextConfig;
