/** @type {import('tailwindcss').Config} */

// These colors match the `colors` object in src/theme/config.ts
// Update this safelist if you change your color scheme
const colors = ['emerald', 'teal', 'amber', 'rose', 'neutral'];
const shades = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950];

// Generate safelist for all color utilities used dynamically in theme/config.ts
const colorSafelist = colors.flatMap(color => 
  shades.flatMap(shade => [
    `bg-${color}-${shade}`,
    `bg-${color}-${shade}/5`,
    `bg-${color}-${shade}/20`,
    `bg-${color}-${shade}/60`,
    `hover:bg-${color}-${shade}`,
    `hover:bg-${color}-${shade}/70`,
    `text-${color}-${shade}`,
    `hover:text-${color}-${shade}`,
    `border-${color}-${shade}`,
    `border-${color}-${shade}/30`,
    `ring-${color}-${shade}`,
    `focus:ring-${color}-${shade}`,
    `ring-offset-${color}-${shade}`,
    `focus:ring-offset-${color}-${shade}`,
    `caret-${color}-${shade}`,
    `placeholder:text-${color}-${shade}`,
    `odd:bg-${color}-${shade}`,
    `even:bg-${color}-${shade}`,
    `even:bg-${color}-${shade}/60`,
    `data-[active=true]:bg-${color}-${shade}/70`,
    `focus-within:ring-${color}-${shade}`,
  ])
);

module.exports = {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  safelist: colorSafelist,
  theme: {
    extend: {
      fontFamily: {
        sans: ['system-ui', 'sans-serif'],
      },
      borderRadius: {
        'xl': '1rem',
      },
      animation: {
        'shimmer': 'shimmer 2s ease-in-out infinite',
      },
      keyframes: {
        shimmer: {
          '0%, 100%': { transform: 'translateX(-100%)' },
          '50%': { transform: 'translateX(100%)' },
        },
      },
    },
  },
  plugins: [],
}

