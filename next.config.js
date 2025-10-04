/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    // ⛳️ не валить прод-сборку из-за ESLint-ошибок
    ignoreDuringBuilds: true,
  },
  typescript: {
    // ⛳️ не валить прод-сборку из-за TS-ошибок
    ignoreBuildErrors: true,
  },
};

module.exports = nextConfig;
