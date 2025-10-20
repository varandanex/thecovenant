/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com"
      },
      {
        protocol: "https",
        hostname: "www.thecovenant.es"
      }
    ]
  }
  ,
  // Reduce dev-server startup time by ignoring large artifact folders (images, exports)
  // Next will skip watching these paths which otherwise slow down initial file-walk.
  webpackDevMiddleware: {
    watchOptions: {
      ignored: ['**/data/**', '**/.git/**', '**/node_modules/**']
    }
  }
};

export default nextConfig;
