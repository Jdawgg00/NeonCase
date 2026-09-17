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
    // Deliberately no localhost fallback here. AUTH_ORIGIN is a runtime env
    // var (Buildpacks build env only accepts BP_* names), so it's always
    // unset at build time in a Minato build -- a fallback string would bake
    // in as a permanent, wrong absolute URL. @sidebase/nuxt-auth's own
    // client/SSR auth-state composable (dist/runtime/composables/
    // commonAuthState.js) only takes its *correct*, per-request dynamic
    // origin path when this resolves to nothing at build time; once it had
    // a (wrong) fallback, every session check used that fallback forever,
    // which is what sent the browser to a dead localhost URL on a refresh.
    // Leaving it unset here is correct for local dev too: the dynamic path
    // reads the actual incoming request's own host either way.
    baseURL: process.env.AUTH_ORIGIN,
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
