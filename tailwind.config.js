/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ash: '#d6d6d6',
        iron: '#2a2a33',
        accent: '#7b5cff',
      },
      borderRadius: {
        'xl2': '1rem',
      }
    },
  },
  plugins: [],
}
