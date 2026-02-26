import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        surface: {
          950: "#0c0a14",
          900: "#13101f",
          850: "#191530",
          800: "#1e1a35",
          750: "#262240",
          700: "#302d4a",
          600: "#3f3b5c",
          500: "#534f70",
          400: "#7d7a96",
          300: "#a8a5be",
          200: "#d4d2e3",
        },
        accent: {
          DEFAULT: "#22d3ee",
          light: "#67e8f9",
          dark: "#06b6d4",
        },
        warn: {
          DEFAULT: "#f59e0b",
          light: "#fbbf24",
        },
      },
      boxShadow: {
        glass:
          "0 4px 24px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.04)",
        "glass-hover":
          "0 8px 32px rgba(0, 0, 0, 0.35), 0 0 20px rgba(34, 211, 238, 0.12), inset 0 1px 0 rgba(255, 255, 255, 0.06)",
        "glow-cyan": "0 0 20px rgba(34, 211, 238, 0.15)",
      },
      animation: {
        "fade-in": "fadeIn 0.4s ease-out both",
        "slide-up": "slideUp 0.5s ease-out both",
        "skeleton-shimmer": "skeletonShimmer 1.5s ease-in-out infinite",
      },
      keyframes: {
        fadeIn: {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
        slideUp: {
          from: { opacity: "0", transform: "translateY(12px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        skeletonShimmer: {
          "0%": { backgroundPosition: "200% 0" },
          "100%": { backgroundPosition: "-200% 0" },
        },
      },
    },
  },
  plugins: [],
};
export default config;
