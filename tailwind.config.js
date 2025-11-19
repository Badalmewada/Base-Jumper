/** @type {import('tailwindcss').Config} */
export default {
  content: [
    // This tells Tailwind to look in all .js, .jsx, .ts, .tsx files
    // inside the 'src' directory for class names.
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      // Set the default font to Inter for consistency
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
        mono: ['Menlo', 'monospace'], // Keep mono for the game feel
      },
    },
  },
  plugins: [],
}