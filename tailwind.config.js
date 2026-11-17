/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        felt: {
          DEFAULT: '#0f3822',
          dark: '#082114',
          light: '#175232',
        },
      },
    },
  },
  plugins: [],
};
