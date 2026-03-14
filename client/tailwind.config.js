/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'f1-red': '#FF1801',
        'f1-carbon': '#15151E',
        'f1-asphalt': '#2D2D3A',
        'f1-white': '#FDFDFD',
        'f1-green': '#00D26A',
      },
      fontFamily: {
        racing: ['"Saira"', 'sans-serif'],
        body: ['"Inter"', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
