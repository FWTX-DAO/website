/** @type {import('tailwindcss').Config} */
const defaultTheme = require("tailwindcss/defaultTheme");

module.exports = {
  content: ["./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Inter Variable", "Inter", ...defaultTheme.fontFamily.sans],
        mono: ["JetBrains Mono", "Fira Code", ...defaultTheme.fontFamily.mono],
      },
      colors: {
        // Cybernetic primary palette
        cyber: {
          dark: "#0A0F1C",
          darker: "#060912",
          navy: "#111827",
          slate: "#1E293B",
        },
        // Neon accent colors
        neon: {
          cyan: "#00FFFF",
          blue: "#0066FF",
          purple: "#8B5CF6",
          magenta: "#FF00FF",
          green: "#00FF88",
          pink: "#FF0080",
        },
        // Glow variants (for shadows/borders)
        glow: {
          cyan: "rgba(0, 255, 255, 0.5)",
          blue: "rgba(0, 102, 255, 0.5)",
          purple: "rgba(139, 92, 246, 0.5)",
          magenta: "rgba(255, 0, 255, 0.5)",
        },
      },
      boxShadow: {
        "glow-sm": "0 0 10px rgba(0, 255, 255, 0.3)",
        "glow-md": "0 0 20px rgba(0, 255, 255, 0.4)",
        "glow-lg": "0 0 30px rgba(0, 255, 255, 0.5)",
        "glow-cyan": "0 0 20px rgba(0, 255, 255, 0.5), 0 0 40px rgba(0, 255, 255, 0.3)",
        "glow-blue": "0 0 20px rgba(0, 102, 255, 0.5), 0 0 40px rgba(0, 102, 255, 0.3)",
        "glow-purple": "0 0 20px rgba(139, 92, 246, 0.5), 0 0 40px rgba(139, 92, 246, 0.3)",
        "glow-magenta": "0 0 20px rgba(255, 0, 255, 0.5), 0 0 40px rgba(255, 0, 255, 0.3)",
        "inner-glow": "inset 0 0 20px rgba(0, 255, 255, 0.1)",
      },
      backgroundImage: {
        "cyber-gradient": "linear-gradient(135deg, #0A0F1C 0%, #1E293B 50%, #0A0F1C 100%)",
        "neon-gradient": "linear-gradient(90deg, #00FFFF 0%, #0066FF 50%, #8B5CF6 100%)",
        "glow-gradient": "linear-gradient(90deg, rgba(0,255,255,0.1) 0%, rgba(139,92,246,0.1) 100%)",
        "grid-pattern": "linear-gradient(rgba(0,255,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(0,255,255,0.03) 1px, transparent 1px)",
      },
      backgroundSize: {
        "grid": "50px 50px",
      },
      animation: {
        "glow-pulse": "glow-pulse 2s ease-in-out infinite",
        "border-glow": "border-glow 3s ease-in-out infinite",
        "float": "float 6s ease-in-out infinite",
        "shimmer": "shimmer 2s linear infinite",
        "fade-in": "fade-in 0.5s ease-out",
        "slide-up": "slide-up 0.5s ease-out",
        "text-glow": "text-glow 2s ease-in-out infinite alternate",
      },
      keyframes: {
        "glow-pulse": {
          "0%, 100%": { boxShadow: "0 0 20px rgba(0, 255, 255, 0.3)" },
          "50%": { boxShadow: "0 0 40px rgba(0, 255, 255, 0.6)" },
        },
        "border-glow": {
          "0%, 100%": { borderColor: "rgba(0, 255, 255, 0.5)" },
          "50%": { borderColor: "rgba(139, 92, 246, 0.8)" },
        },
        "float": {
          "0%, 100%": { transform: "translateY(0px)" },
          "50%": { transform: "translateY(-10px)" },
        },
        "shimmer": {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
        "fade-in": {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        "slide-up": {
          "0%": { opacity: "0", transform: "translateY(20px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "text-glow": {
          "0%": { textShadow: "0 0 10px rgba(0, 255, 255, 0.5)" },
          "100%": { textShadow: "0 0 20px rgba(0, 255, 255, 0.8), 0 0 30px rgba(139, 92, 246, 0.6)" },
        },
      },
      borderRadius: {
        "cyber": "2px",
      },
    },
  },
  plugins: [require("@tailwindcss/typography")],
};
