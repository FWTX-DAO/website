/** @type {import('tailwindcss').Config} */
const defaultTheme = require("tailwindcss/defaultTheme");

module.exports = {
  content: ["./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Plus Jakarta Sans Variable", "Plus Jakarta Sans", ...defaultTheme.fontFamily.sans],
        display: ["Teko", ...defaultTheme.fontFamily.sans],
        mono: ["JetBrains Mono", "Fira Code", ...defaultTheme.fontFamily.mono],
      },
      colors: {
        navy: {
          950: "#0A0F1C",
          900: "#0F1629",
          800: "#152037",
          700: "#1E293B",
          600: "#2A3A52",
        },
        cyber: {
          dark: "#0A0F1C",
          slate: "#1E293B",
        },
        neon: {
          cyan: "#22D3EE",
          purple: "#A78BFA",
        },
        frontier: {
          amber: "#FBBF24",
          copper: "#D97706",
        },
      },
      boxShadow: {
        "glow-sm": "0 0 10px rgba(59, 130, 246, 0.2)",
        "glow-md": "0 0 20px rgba(59, 130, 246, 0.3)",
        "glow-lg": "0 0 30px rgba(59, 130, 246, 0.4)",
        "glow-blue": "0 0 20px rgba(59, 130, 246, 0.4), 0 0 40px rgba(59, 130, 246, 0.2)",
        "glow-amber": "0 0 20px rgba(251, 191, 36, 0.35), 0 0 40px rgba(251, 191, 36, 0.15)",
      },
      animation: {
        "glow-pulse": "glow-pulse 2s ease-in-out infinite",
        "border-glow": "border-glow 3s ease-in-out infinite",
        "float": "float 6s ease-in-out infinite",
        "fade-in": "fade-in 0.5s ease-out",
        "slide-up": "slide-up 0.5s ease-out",
      },
      keyframes: {
        "glow-pulse": {
          "0%, 100%": { boxShadow: "0 0 20px rgba(59, 130, 246, 0.2)" },
          "50%": { boxShadow: "0 0 40px rgba(59, 130, 246, 0.4)" },
        },
        "border-glow": {
          "0%, 100%": { borderColor: "rgba(59, 130, 246, 0.3)" },
          "50%": { borderColor: "rgba(59, 130, 246, 0.6)" },
        },
        "float": {
          "0%, 100%": { transform: "translateY(0px)" },
          "50%": { transform: "translateY(-10px)" },
        },
        "fade-in": {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        "slide-up": {
          "0%": { opacity: "0", transform: "translateY(20px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
      },
    },
  },
  plugins: [require("@tailwindcss/typography")],
};
