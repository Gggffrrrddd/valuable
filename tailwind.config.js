/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        /*
         * Deep-violet + muted-gold system (2026 premium retheme).
         * The legacy ramp names (lime/stone/slate/emerald/amber) are remapped
         * onto the new palette so every existing class-based usage converts in
         * one move. brand.* holds the canonical tokens for new code.
         */
        brand: {
          base: '#1A0E2E',      // deepest violet-black — app background
          surface: '#241536',   // card / surface violet
          elevated: '#2C1B42',  // raised surfaces, hovers
          ink: '#120921',       // near-navy ink — gradient floor
          gold: '#D4AF7F',      // primary accent — muted warm gold
          goldSoft: '#EAD7B8',  // lighter gold (hovers, highlights)
          goldDeep: '#C89F6A',  // deeper gold-bronze
          rose: '#C99BA8',      // rare grace-note accent
          mist: '#9B8FAE',      // muted lavender-grey — secondary text
          ivory: '#F0EAE0',     // primary text — warm cream
        },
        // Per-visual signature hues — the app's multi-color accent system.
        visual: {
          gold: '#D4AF7F',   // hourglass
          green: '#8FBC7F',  // tree
          teal: '#6FB5A8',   // jar
          blue: '#7C9FE8',   // horse
          amber: '#C98B5E',  // blade
          violet: '#A78BFA', // study table
        },
        // Primary accent ramp (was neon lime) → muted gold.
        lime: {
          50: '#FBF6EC',
          100: '#F5EBD8',
          200: '#EAD7B8',
          300: '#D4AF7F',
          400: '#CDA673',
          500: '#C1975F',
          600: '#9E7B4B',
          700: '#7A5E39',
          800: '#57432A',
          900: '#3B2E1D',
        },
        // Neutral text ramp (was warm stone-grey) → ivory → lavender-grey.
        stone: {
          50: '#F0EAE0',
          100: '#E8E2D6',
          200: '#D3CDD3',
          300: '#B9B3C0',
          400: '#A79FB0',
          500: '#9B8FAE',
          600: '#817596',
          700: '#675E7C',
          800: '#4B4360',
          900: '#353046',
        },
        // Legacy screens (was cool slate) → violet-tinted neutrals.
        slate: {
          50: '#F0EAE0',
          100: '#EAE5EF',
          200: '#DAD5E2',
          300: '#C6C0D2',
          400: '#ACA4BD',
          500: '#9B8FAE',
          600: '#7E7292',
          700: '#5E5273',
          800: '#3A2F52',
          900: '#241536',
          950: '#170D26',
        },
        // Legacy accent (was emerald) → gold family.
        emerald: {
          300: '#D4AF7F',
          400: '#D4AF7F',
          500: '#C89F6A',
          600: '#B8935F',
          700: '#9E7B4B',
          800: '#7A5E39',
          900: '#57432A',
        },
        // Break-screen ramp (was saturated amber) → champagne gold.
        amber: {
          50: '#FAF4EA',
          100: '#F3E9D9',
          200: '#EBDCC2',
          300: '#E2C9A2',
          400: '#D9B98C',
          500: '#D4AF7F',
          600: '#B89566',
          700: '#96784E',
          800: '#6E5838',
          900: '#493A25',
        },
      },
    },
  },
  plugins: [],
};
