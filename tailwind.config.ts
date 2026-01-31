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
      },
      fontFamily: {
        serif: ['Playfair Display', 'Georgia', 'Times New Roman', 'serif'],
        sans: ['Source Sans Pro', 'system-ui', '-apple-system', 'sans-serif'],
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
      },
    },
  },
  plugins: [],
}

export default config
