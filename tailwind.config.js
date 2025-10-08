/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
    "./**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'brand-primary': '#007aff',
        'brand-secondary': '#34c759',
        'background-dark': '#0f0f0f',
        'surface-dark': '#1a1a1a',
        'on-surface-dark': '#e5e5e5',
        'on-surface-dark-secondary': '#a3a3a3',
      },
      placeholderColor: {
        'on-surface-dark-secondary': '#d1d5db',
        'gray-400': '#9ca3af',
      },
    },
  },
  plugins: [],
}
