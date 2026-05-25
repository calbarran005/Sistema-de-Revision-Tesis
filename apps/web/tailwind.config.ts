import type { Config } from 'tailwindcss';

export default {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: { DEFAULT: '#1e3a5f', 50: '#eff6ff', 100: '#dbeafe', 200: '#bfdbfe', 500: '#3b82f6', 600: '#2563eb', 700: '#1d4ed8', 800: '#1e40af', 900: '#1e3a5f' },
        brand: { navy: '#1e3a5f', blue: '#2563eb', light: '#eff6ff' },
      },
      fontFamily: { sans: ['Inter', 'system-ui', 'sans-serif'] },
      animation: { 'spin-slow': 'spin 3s linear infinite', 'pulse-dot': 'pulse 1.5s ease-in-out infinite' },
    },
  },
  plugins: [],
} satisfies Config;
