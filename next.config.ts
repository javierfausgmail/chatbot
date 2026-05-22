import type { NextConfig } from "next";

const basePath = process.env.IS_DEMO === "1" ? "/demo" : "";

const nextConfig: NextConfig = {
  ...(basePath
    ? {
        basePath,
        assetPrefix: "/demo-assets",
        redirects: async () => [
          {
            source: "/",
            destination: basePath,
            permanent: false,
            basePath: false,
          },
        ],
      }
    : {}),

  output: "standalone",

  env: {
    NEXT_PUBLIC_BASE_PATH: basePath,
  },

  cacheComponents: true,
  devIndicators: false,
  poweredByHeader: false,
  reactCompiler: true,

  logging: {
    fetches: {
      fullUrl: false,
    },
    incomingRequests: false,
  },

  images: {
    remotePatterns: [
      {
        hostname: "avatar.vercel.sh",
      },
      {
        protocol: "http",
        hostname: "localhost",
        port: "3000",
      },
      // Añadimos el nuevo origen aquí
      {
        protocol: "http",
        hostname: "**",
      },
    ],
  },

  // 2. Permite acceso total de CORS para todas las rutas
  headers: async () => {
    return [
      {
        // Aplica a todas las rutas de tu aplicación
        source: "/:path*",
        headers: [
          {
            key: "Access-Control-Allow-Origin",
            value: "*", // Permite cualquier origen
          },
          {
            key: "Access-Control-Allow-Methods",
            value: "GET, POST, PUT, DELETE, OPTIONS",
          },
          {
            key: "Access-Control-Allow-Headers",
            value: "X-Requested-With, Content-Type, Authorization",
          },
        ],
      },
    ];
  },

  experimental: {
    prefetchInlining: true,
    cachedNavigations: true,
    appNewScrollHandler: true,
    inlineCss: true,
    turbopackFileSystemCacheForDev: true,
  },
};

export default nextConfig;
