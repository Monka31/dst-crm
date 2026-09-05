import type { Config } from "tailwindcss";

export default {
  darkMode: "class",
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        /* Bleu ESSEC — couleur d'accent unique de l'interface. */
        brand: {
          50: "#eef8fd",
          100: "#d6eefb",
          200: "#aeddf6",
          300: "#7cc7ef",
          400: "#47b0e7",
          500: "#1da1e0",
          600: "#1482ba",
          700: "#136894",
          800: "#155679",
          900: "#164865",
        },
        /* Charbon institutionnel : panneaux sombres, en-têtes. */
        navy: {
          50: "#f4f6f7",
          100: "#e8ebed",
          200: "#ced4d8",
          300: "#aab4bb",
          400: "#7d8b95",
          500: "#5c6a75",
          600: "#48545d",
          700: "#3b444b",
          800: "#2b3238",
          900: "#1e2429",
        },
        /* Neutres ancrés sur le #333333 de la charte, légèrement froids. */
        slate: {
          50: "#f7f8f9",
          100: "#eff1f3",
          200: "#e2e6e9",
          300: "#cbd1d6",
          400: "#98a1aa",
          500: "#6c757e",
          600: "#4e565d",
          700: "#3b4248",
          800: "#292f34",
          900: "#1b2024",
          950: "#111518",
        },
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        serif: ["var(--font-serif)", "Georgia", "serif"],
      },
      borderRadius: {
        DEFAULT: "3px",
        sm: "2px",
        md: "3px",
        lg: "4px",
        xl: "5px",
        "2xl": "6px",
        full: "9999px",
      },
      boxShadow: {
        sm: "0 1px 2px rgba(27, 32, 36, .05)",
        DEFAULT: "0 1px 3px rgba(27, 32, 36, .07)",
        md: "0 4px 14px rgba(27, 32, 36, .09)",
        lg: "0 16px 48px rgba(27, 32, 36, .18)",
      },
    },
  },
  plugins: [],
} satisfies Config;
