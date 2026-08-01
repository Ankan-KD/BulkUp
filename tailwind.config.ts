import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        display: ["var(--font-display)"],
        body: ["var(--font-body)"],
      },
      colors: {
        // Primary + secondary + warm accents, and the deep neutral scale,
        // are all wired to CSS custom properties (defined per-theme in
        // globals.css as "R G B" triplets) instead of fixed hex values.
        // That's what lets a single set of utility classes — nova-500,
        // aurora-400/15, ember-600, void-950/60, etc. — automatically
        // repaint for light, dark, AND princess without a parallel set of
        // per-class theme overrides. Add a new shade here once; give it a
        // value in every theme's :root/.dark/.princess block in globals.css.
        nova: {
          50: "rgb(var(--c-nova-50) / <alpha-value>)",
          100: "rgb(var(--c-nova-100) / <alpha-value>)",
          200: "rgb(var(--c-nova-200) / <alpha-value>)",
          300: "rgb(var(--c-nova-300) / <alpha-value>)",
          400: "rgb(var(--c-nova-400) / <alpha-value>)",
          500: "rgb(var(--c-nova-500) / <alpha-value>)",
          600: "rgb(var(--c-nova-600) / <alpha-value>)",
          700: "rgb(var(--c-nova-700) / <alpha-value>)",
          800: "rgb(var(--c-nova-800) / <alpha-value>)",
          900: "rgb(var(--c-nova-900) / <alpha-value>)",
          950: "rgb(var(--c-nova-950) / <alpha-value>)",
        },
        aurora: {
          50: "rgb(var(--c-aurora-50) / <alpha-value>)",
          100: "rgb(var(--c-aurora-100) / <alpha-value>)",
          200: "rgb(var(--c-aurora-200) / <alpha-value>)",
          300: "rgb(var(--c-aurora-300) / <alpha-value>)",
          400: "rgb(var(--c-aurora-400) / <alpha-value>)",
          500: "rgb(var(--c-aurora-500) / <alpha-value>)",
          600: "rgb(var(--c-aurora-600) / <alpha-value>)",
          700: "rgb(var(--c-aurora-700) / <alpha-value>)",
          800: "rgb(var(--c-aurora-800) / <alpha-value>)",
          900: "rgb(var(--c-aurora-900) / <alpha-value>)",
          950: "rgb(var(--c-aurora-950) / <alpha-value>)",
        },
        ember: {
          50: "rgb(var(--c-ember-50) / <alpha-value>)",
          100: "rgb(var(--c-ember-100) / <alpha-value>)",
          200: "rgb(var(--c-ember-200) / <alpha-value>)",
          300: "rgb(var(--c-ember-300) / <alpha-value>)",
          400: "rgb(var(--c-ember-400) / <alpha-value>)",
          500: "rgb(var(--c-ember-500) / <alpha-value>)",
          600: "rgb(var(--c-ember-600) / <alpha-value>)",
          700: "rgb(var(--c-ember-700) / <alpha-value>)",
          800: "rgb(var(--c-ember-800) / <alpha-value>)",
          900: "rgb(var(--c-ember-900) / <alpha-value>)",
        },
        void: {
          50: "rgb(var(--c-void-50) / <alpha-value>)",
          100: "rgb(var(--c-void-100) / <alpha-value>)",
          200: "rgb(var(--c-void-200) / <alpha-value>)",
          300: "rgb(var(--c-void-300) / <alpha-value>)",
          400: "rgb(var(--c-void-400) / <alpha-value>)",
          500: "rgb(var(--c-void-500) / <alpha-value>)",
          600: "rgb(var(--c-void-600) / <alpha-value>)",
          700: "rgb(var(--c-void-700) / <alpha-value>)",
          800: "rgb(var(--c-void-800) / <alpha-value>)",
          900: "rgb(var(--c-void-900) / <alpha-value>)",
          950: "rgb(var(--c-void-950) / <alpha-value>)",
        },
      },
      borderRadius: {
        xl2: "1.375rem",
      },
      boxShadow: {
        soft: "0 1px 2px rgba(15, 15, 35, 0.06), 0 4px 16px -6px rgba(15, 15, 35, 0.10)",
        card: "0 6px 24px -8px rgba(15, 15, 35, 0.16)",
        glow: "0 0 0 3px rgba(124, 92, 240, 0.12)",
        "glow-nova": "0 4px 20px -6px rgba(124, 92, 240, 0.35)",
        "glow-aurora": "0 4px 20px -6px rgba(46, 207, 221, 0.35)",
        "glow-ember": "0 4px 20px -6px rgba(245, 96, 31, 0.3)",
      },
      keyframes: {
        "grow-in": {
          "0%": { transform: "scale(0.9)", opacity: "0" },
          "100%": { transform: "scale(1)", opacity: "1" },
        },
        sway: {
          "0%, 100%": { transform: "rotate(-1.5deg)" },
          "50%": { transform: "rotate(1.5deg)" },
        },
        pop: {
          "0%": { transform: "scale(0.85)", opacity: "0" },
          "60%": { transform: "scale(1.05)", opacity: "1" },
          "100%": { transform: "scale(1)" },
        },
        "pulse-glow": {
          "0%, 100%": { opacity: "0.55", transform: "scale(1)" },
          "50%": { opacity: "1", transform: "scale(1.06)" },
        },
        twinkle: {
          "0%, 100%": { opacity: "0.2" },
          "50%": { opacity: "0.9" },
        },
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
      },
      animation: {
        "grow-in": "grow-in 0.2s ease-out",
        sway: "sway 4s ease-in-out infinite",
        pop: "pop 0.22s cubic-bezier(0.34,1.56,0.64,1)",
        "pulse-glow": "pulse-glow 3.2s ease-in-out infinite",
        twinkle: "twinkle 4s ease-in-out infinite",
        "fade-in": "fadeIn 150ms ease",
      },
    },
  },
  plugins: [],
};
export default config;
