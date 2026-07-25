import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        display: ["var(--font-display)"],
        body: ["var(--font-body)"],
      },
      colors: {
        // Primary cosmic accent — violet/indigo
        nova: {
          50: "#f2efff",
          100: "#e4defe",
          200: "#c9bdfd",
          300: "#a892fa",
          400: "#8a6cf5",
          500: "#7c5cf0",
          600: "#6d43e8",
          700: "#5a32c9",
          800: "#4a2aa0",
          900: "#3a2378",
          950: "#221650",
        },
        // Secondary cosmic accent — cyan/teal glow
        aurora: {
          50: "#e9fdfd",
          100: "#c9f9fa",
          200: "#98f0f4",
          300: "#5fe1ea",
          400: "#2ecfdd",
          500: "#17b6c7",
          600: "#1194a3",
          700: "#127684",
          800: "#155f6a",
          900: "#154f59",
          950: "#08333b",
        },
        // Warm accent for calories / streaks
        ember: {
          50: "#fff3ec",
          100: "#ffe2cf",
          200: "#ffc199",
          300: "#ff9d61",
          400: "#fc7c3c",
          500: "#f5601f",
          600: "#dd4614",
          700: "#b73512",
          800: "#912c14",
          900: "#762712",
        },
        // Deep space neutrals used for backgrounds / overlays
        void: {
          50: "#eef0f8",
          100: "#d6dbec",
          200: "#a9b1d2",
          300: "#7982ab",
          400: "#4c5480",
          500: "#333a63",
          600: "#242a4d",
          700: "#191d3a",
          800: "#12152c",
          900: "#0b0d1e",
          950: "#050614",
        },
      },
      borderRadius: {
        xl2: "1.25rem",
      },
      boxShadow: {
        soft: "0 2px 10px -2px rgba(5, 6, 20, 0.35), 0 1px 2px rgba(5,6,20,0.2)",
        card: "0 8px 30px -6px rgba(5, 6, 20, 0.55)",
        glow: "0 0 0 4px rgba(124, 92, 240, 0.16)",
        "glow-nova": "0 0 24px -4px rgba(124, 92, 240, 0.55), 0 0 4px rgba(124, 92, 240, 0.4)",
        "glow-aurora": "0 0 24px -4px rgba(46, 207, 221, 0.5), 0 0 4px rgba(46, 207, 221, 0.35)",
        "glow-ember": "0 0 24px -4px rgba(245, 96, 31, 0.45), 0 0 4px rgba(245, 96, 31, 0.3)",
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
