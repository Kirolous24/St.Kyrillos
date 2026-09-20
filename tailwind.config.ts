import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Primary - Deep Burgundy/Maroon (Coptic liturgical color)
        primary: {
          50: '#fdf2f3',
          100: '#fce7e9',
          200: '#f9d2d6',
          300: '#f4adb5',
          400: '#ec7f8d',
          500: '#e05268',
          600: '#c9334f',
          700: '#a82640',
          800: '#8c223a',
          900: '#722f37', // Main primary
          950: '#4a1c23', // Dark primary
        },
        // Secondary - Warm Gold
        secondary: {
          50: '#fefbe8',
          100: '#fff8c2',
          200: '#ffed89',
          300: '#ffdc45',
          400: '#fcc815',
          500: '#ecae08',
          600: '#c98704',
          700: '#a05f07',
          800: '#844b0e',
          900: '#703d12',
          950: '#412006',
        },
        // Gold accent
        gold: {
          light: '#E8D48B',
          DEFAULT: '#C9A227',
          dark: '#A07D1C',
        },

        // ── Sunday School portal palette (from the prototype's :root) ──
        // Deliberately separate from `primary`/`gold` so the public site is
        // untouched. Portal components use brand-* / parch-* exclusively.
        brand: {
          50: '#FAF2F0',
          100: '#F4E0DD',
          200: '#E9C4C0',
          300: '#D79A94',
          400: '#BD625C',
          500: '#A03D38',
          600: '#8A2C29',
          700: '#7A2525', // --navy-mid
          800: '#6F1D1B', // --navy (primary burgundy)
          900: '#6F1D1B',
          950: '#4A1212', // --navy-dark
          gold: '#C89B3C', // --gold
          'gold-light': '#E8B85A', // --gold-light
          'gold-dark': '#8B5A0F', // the prototype's own deep gold; 5.8:1 on cream (AA) — #A97F2B was 3.6:1
          'gold-muted': '#8B5A0F', // sidebar group labels — the prototype's own accent, 5.8:1 on cream (AA)
          wash: '#FDF5E4', // active nav / gold tint surface
          hover: '#FAF7F0', // nav hover
        },
        // Warm neutral ramp: parchment ground, warm borders, soft ink.
        parch: {
          50: '#FFFDF8', // --white
          100: '#F8F4EC', // --off (page ground)
          200: '#E7E2DA', // --border / --gray-light
          300: '#D8D1C6',
          400: '#A9A49B',
          500: '#5C5A5A', // --gray (darkened from #7C7A7A for AA text contrast on parch-50/100)
          600: '#65625F',
          700: '#4E4A48',
          800: '#3A3537',
          900: '#2F2930', // --text
          950: '#221D22',
        },
      },
      fontFamily: {
        serif: ['Playfair Display', 'Georgia', 'Times New Roman', 'serif'],
        sans: ['Source Sans Pro', 'system-ui', '-apple-system', 'sans-serif'],
        // Portal body face (prototype uses Lato).
        body: ['Lato', 'Inter', 'system-ui', '-apple-system', 'sans-serif'],
        display: ['Cinzel', 'Playfair Display', 'Georgia', 'serif'],
      },
      fontSize: {
        // Custom type scale
        'display-1': ['4rem', { lineHeight: '1.1', letterSpacing: '-0.02em' }],
        'display-2': ['3rem', { lineHeight: '1.2', letterSpacing: '-0.01em' }],
        'heading-1': ['2.5rem', { lineHeight: '1.2' }],
        'heading-2': ['2rem', { lineHeight: '1.3' }],
        'heading-3': ['1.5rem', { lineHeight: '1.4' }],
        'heading-4': ['1.25rem', { lineHeight: '1.4' }],
        'body-lg': ['1.125rem', { lineHeight: '1.7' }],
        'body': ['1rem', { lineHeight: '1.7' }],
        'body-sm': ['0.875rem', { lineHeight: '1.6' }],
      },
      spacing: {
        '18': '4.5rem',
        '22': '5.5rem',
      },
      boxShadow: {
        'soft': '0 4px 12px rgba(0, 0, 0, 0.08)',
        'soft-lg': '0 8px 24px rgba(0, 0, 0, 0.12)',
        'soft-xl': '0 12px 40px rgba(0, 0, 0, 0.16)',
        // Portal surfaces: warm, low-contrast lift on a parchment ground.
        parch: '0 1px 2px rgba(47, 41, 48, 0.04), 0 2px 8px rgba(47, 41, 48, 0.05)',
        'parch-lg': '0 2px 4px rgba(47, 41, 48, 0.05), 0 12px 28px rgba(47, 41, 48, 0.09)',
        // Verbatim from the prototype's stylesheet.
        panel: '0 8px 28px rgba(74, 18, 18, .055)',
        rail: '0 8px 24px rgba(0,0,0,.14), inset 0 1px 0 rgba(255,255,255,.5)',
        banner: '0 4px 14px rgba(74, 18, 18, .18)',
        hero: '0 14px 36px rgba(111, 29, 27, .15)',
        card: '0 1px 4px rgba(74, 59, 50, .05)',
        'nav-on': '0 2px 10px -3px rgba(200, 155, 60, .4)',
      },
    },
  },
  plugins: [],
}

export default config
