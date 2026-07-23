/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: 'var(--brand-50)', 100: 'var(--brand-100)', 200: 'var(--brand-200)', 300: 'var(--brand-300)',
          400: 'var(--brand-400)', 500: 'var(--brand-500)', 600: 'var(--brand-600)', 700: 'var(--brand-700)',
          800: 'var(--brand-800)', 900: 'var(--brand-900)',
        },
      },
      fontFamily: {
        sans: ['"Inter"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        card: '0 1px 2px 0 rgb(0 0 0 / 0.04), 0 1px 3px 0 rgb(0 0 0 / 0.06)',
        'card-hover': '0 4px 12px -2px rgb(0 0 0 / 0.08), 0 2px 4px -2px rgb(0 0 0 / 0.06)',
        popover: '0 8px 24px -4px rgb(0 0 0 / 0.12), 0 4px 8px -4px rgb(0 0 0 / 0.08)',
      },
      animation: {
        'fade-in': 'fadeIn 150ms ease-out',
        'scale-in': 'scaleIn 150ms ease-out',
        'slide-in-right': 'slideInRight 200ms ease-out',
      },
      keyframes: {
        fadeIn: { '0%': { opacity: 0 }, '100%': { opacity: 1 } },
        scaleIn: { '0%': { opacity: 0, transform: 'scale(0.96)' }, '100%': { opacity: 1, transform: 'scale(1)' } },
        slideInRight: { '0%': { opacity: 0, transform: 'translateX(12px)' }, '100%': { opacity: 1, transform: 'translateX(0)' } },
      },
    },
  },
  plugins: [],
};