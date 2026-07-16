/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#eef7ff',
          100: '#d9edff',
          200: '#bce0ff',
          300: '#8ecdff',
          400: '#59b0ff',
          500: '#3390fa',
          600: '#1d71ef',
          700: '#175bdc',
          800: '#1949b2',
          900: '#1a418c',
        },
      },
    },
  },
  plugins: [],
};
