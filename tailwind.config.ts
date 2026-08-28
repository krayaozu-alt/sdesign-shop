import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      // Palette officielle S.DESIGN SHOP
      colors: {
        night: {
          950: '#08070A', // noir profond de la charte
          900: '#181818', // graphite
          800: '#1C0722',
          700: '#250A30', // aubergine profond
          600: '#3B0F52', // violet
          500: '#4E1668',
        },
        plum: {
          400: '#6B2A87',
          300: '#8A3FA6',
          200: '#A661BE',
        },
        gold: {
          700: '#8A6E1F',
          600: '#A98A22',
          500: '#C9A227', // or premium
          400: '#D6B444',
          300: '#E5C76B', // or clair
          200: '#F0DCA8',
        },
        cream: {
          DEFAULT: '#FAF8F4', // blanc cassé
          muted: '#C9C3CD',
          dim: '#777777', // gris
        },
      },
      fontFamily: {
        display: ['"Playfair Display"', 'Georgia', 'Cambria', 'serif'],
        script: ['"Cormorant Garamond"', '"Playfair Display"', 'Georgia', 'serif'],
        sans: ['Inter', '"Segoe UI"', 'system-ui', '-apple-system', 'sans-serif'],
      },
      // Paliers d'opacite intermediaires utilises par la charte (liseres dores,
      // surfaces translucides) : absents de l'echelle Tailwind par defaut.
      opacity: {
        8: '0.08',
        12: '0.12',
        15: '0.15',
        85: '0.85',
      },
      borderRadius: {
        card: '1.25rem',
        pill: '999px',
      },
      boxShadow: {
        card: '0 18px 40px -24px rgba(0, 0, 0, 0.85)',
        gold: '0 10px 30px -12px rgba(201, 162, 39, 0.45)',
        lift: '0 24px 60px -30px rgba(0, 0, 0, 0.9)',
      },
      backgroundImage: {
        'gold-gradient': 'linear-gradient(135deg, #8A6E1F 0%, #E5C76B 45%, #C9A227 100%)',
        'plum-gradient': 'linear-gradient(160deg, #250A30 0%, #08070A 100%)',
        'hero-gradient': 'radial-gradient(120% 90% at 50% 0%, #4E1668 0%, #250A30 45%, #08070A 100%)',
      },
      keyframes: {
        'fade-up': {
          '0%': { opacity: '0', transform: 'translateY(12px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        // Respiration du cercle dore du HERO : une variation de luminosite si
        // lente qu'on ne la voit pas se produire, seulement apres coup.
        'halo-doux': {
          '0%, 100%': { opacity: '0.72' },
          '50%': { opacity: '1' },
        },
      },
      animation: {
        'fade-up': 'fade-up 0.5s ease-out both',
        'fade-in': 'fade-in 0.4s ease-out both',
        shimmer: 'shimmer 2.4s linear infinite',
        'halo-doux': 'halo-doux 7s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};

export default config;
