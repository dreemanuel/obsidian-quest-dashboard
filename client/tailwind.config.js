/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        hud: {
          bg: '#06070A',
          surface: '#0E121A',
          border: '#1B2230',
          accent: '#00F0FF',
          warn: '#FF2D75',
          xp: '#FFD60A',
          success: '#00FF9F',
        },
      },
      fontFamily: {
        hud: ['ui-monospace', 'Menlo', 'Monaco', 'Consolas', 'monospace'],
      },
      animation: {
        'scan-line': 'scan-line 2s linear infinite',
        'glitch': 'glitch 0.4s ease-out',
      },
      keyframes: {
        'scan-line': {
          '0%': { transform: 'translateY(-100%)' },
          '100%': { transform: 'translateY(100%)' },
        },
        'glitch': {
          '0%, 100%': { transform: 'translate(0)' },
          '20%': { transform: 'translate(-2px, 2px)' },
          '40%': { transform: 'translate(2px, -2px)' },
          '60%': { transform: 'translate(-1px, -1px)' },
          '80%': { transform: 'translate(1px, 1px)' },
        },
      },
    },
  },
  plugins: [],
};
