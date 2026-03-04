/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        app: {
          bg: '#0a0d14',
          surface: '#12151f',
          hover: '#1a1e2e',
          border: '#1e2235',
          accent: '#00d395',
          'accent-hover': '#00b580',
          'accent-dim': 'rgba(0, 211, 149, 0.12)',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'monospace'],
      },
    },
  },
  plugins: [],
}
