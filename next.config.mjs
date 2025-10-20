/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  
  // Optimizaciones de rendimiento en desarrollo
  experimental: {
    // Turbopack es más rápido pero aún experimental
    // turbo: {
    //   root: process.cwd(),
    // },
  },

  // Optimizar compilación
  swcMinify: true,
  
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "https", hostname: "www.thecovenant.es" }
    ]
  },
  /**
   * Nota: `webpackDevMiddleware` ya no es una opción válida en Next.js 13+/14.
   * Para reducir el coste de file-watching en modo dev (solo afecta cuando se usa el legacy dev server basado en Webpack),
   * ajustamos `config.watchOptions.ignored` dentro del callback `webpack`.
   * Con Turbopack (dev por defecto) esto normalmente no es necesario, pero mantenemos la intención original.
   */
  webpack: (config, { dev }) => {
    if (dev) {
      // Aseguramos que watchOptions exista (en Webpack) antes de mutar.
      if (!config.watchOptions) {
        config.watchOptions = {};
      }
      // Configuramos los patrones ignorados únicamente con globs aceptados por la validación de Webpack.
      const ignoredGlobs = ['**/.git/**', '**/.next/**', '**/node_modules/**', '**/data/**'];
      // Reasignamos el objeto completo para evitar mutar propiedades inmutables.
      config.watchOptions = {
        ...config.watchOptions,
        ignored: ignoredGlobs,
        // Reducir la agregación de cambios para mejorar el rendimiento
        aggregateTimeout: 300,
        // Usar polling solo si es necesario (comentado por defecto)
        // poll: 1000,
      };

      // Optimización adicional: reducir resolución de módulos
      config.resolve = {
        ...config.resolve,
        symlinks: false,
      };

      // Caché más agresivo en desarrollo
      config.cache = {
        type: 'filesystem',
        ...config.cache,
      };
    }
    return config;
  }
};

export default nextConfig;
