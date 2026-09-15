import type { Config } from 'tailwindcss'

export default <Partial<Config>>{
  content: [
    './app/components/**/*.{vue,js,ts}',
    './app/layouts/**/*.vue',
    './app/pages/**/*.vue',
    './app/app.vue',
  ],
  theme: {
    extend: {
      colors: {
        graphite: {
          950: 'var(--gc-graphite-950)',
          900: 'var(--gc-graphite-900)',
          800: 'var(--gc-graphite-800)',
        },
        steel: {
          700: 'var(--gc-steel-700)',
        },
        rarity: {
          common: 'var(--gc-common)',
          uncommon: 'var(--gc-uncommon)',
          rare: 'var(--gc-rare)',
          epic: 'var(--gc-epic)',
          special: 'var(--gc-special)',
        },
      },
      fontFamily: {
        display: ['"Chakra Petch"', 'sans-serif'],
        body: ['"Inter"', 'sans-serif'],
      },
      clipPath: {
        hex: 'polygon(25% 0%, 75% 0%, 100% 50%, 75% 100%, 25% 100%, 0% 50%)',
      },
    },
  },
  plugins: [],
}
