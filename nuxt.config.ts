// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2026-01-01',
  future: { compatibilityVersion: 4 },
  devtools: { enabled: true },

  modules: ['@nuxtjs/tailwindcss', '@pinia/nuxt', '@sidebase/nuxt-auth', '@vueuse/motion/nuxt'],

  css: ['~/assets/css/tokens.css'],

  typescript: {
    strict: true,
    typeCheck: true,
  },

  // Never trust the client with balances, odds or prices — every mutating
  // route lives under server/api and re-validates everything server-side.
  nitro: {
    experimental: {
      websocket: true,
      tasks: true,
    },
    // Real-world Steam Community Market reference prices, refreshed every 6
    // hours so they drift with the actual market. Skin prices are display
    // only; case/key prices are the actual kr cost to open that case.
    scheduledTasks: {
      '0 */6 * * *': ['pricing:refresh'],
    },
  },

  auth: {
    // baseURL only matters as a build-time fallback: AUTH_ORIGIN is a
    // runtime env var (Buildpacks build env only accepts BP_* names), so
    // this always bakes in as http://localhost:3000 in a Minato build.
    // trustHost makes the server derive the real origin per-request from
    // the incoming Host/X-Forwarded-Host header instead -- safe here since
    // Minato's Gateway is the only entrypoint. Without it, actions that need
    // a server-computed absolute URL (sign-out's redirect, in particular)
    // sent the browser to the baked-in localhost instead of the real host.
    baseURL: process.env.AUTH_ORIGIN || 'http://localhost:3000/api/auth',
    provider: {
      type: 'authjs',
      trustHost: true,
    },
    globalAppMiddleware: {
      isEnabled: false, // we use explicit per-route middleware instead (see server/middleware)
    },
  },

  runtimeConfig: {
    databaseUrl: process.env.DATABASE_URL,
    redisUrl: process.env.REDIS_URL,
    public: {
      appName: 'NeonCrate',
      currencyName: 'kr',
      isDev: process.env.NODE_ENV !== 'production',
    },
  },

  app: {
    head: {
      title: 'NeonCrate',
      meta: [
        { name: 'description', content: 'NeonCrate — et internt, virtuelt case-spill. Ingen ekte penger, ingen reell verdi.' },
      ],
    },
  },
})
