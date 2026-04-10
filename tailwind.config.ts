import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        primary: "#3b82f6",
        accent: "#10b981",
        danger: "#ef4444",
        bgdark: "#0a0f1f",
        bgcard: "#111a2e",
      },
      fontFamily: {
        display: ["'Bebas Neue'", "sans-serif"],
        sans: ["Outfit", "system-ui", "sans-serif"],
      },
      backdropBlur: { xs: "2px" },
      animation: {
        "fade-in": "fadeIn 0.6s ease-out",
        "slide-up": "slideUp 0.6s ease-out",
        float: "float 6s ease-in-out infinite",
      },
      keyframes: {
        fadeIn: { "0%": { opacity: "0" }, "100%": { opacity: "1" } },
        slideUp: { "0%": { opacity: "0", transform: "translateY(30px)" }, "100%": { opacity: "1", transform: "translateY(0)" } },
        float: { "0%,100%": { transform: "translateY(0)" }, "50%": { transform: "translateY(-12px)" } },
      },
    },
  },
  plugins: [],
};
export default config;
