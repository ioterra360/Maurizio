/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,jsx,ts,tsx}",
    "./components/**/*.{js,jsx,ts,tsx}",
    "./features/**/*.{js,jsx,ts,tsx}",
  ],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        // Memora editorial palette (from Memora App.html design contract)
        navy: "#1A2C4F",
        canvas: "#F5F3EF",
        "warm-white": "#FBF9F4",
        surface: "#FFFFFF",
        "mid-grey": "#8A8A88",
        hairline: "rgba(26,44,79,0.08)",
        "hairline-strong": "rgba(26,44,79,0.16)",
        // Layer colors (Scan → Reinforcement → Focus)
        scan: "#6DA8E5",
        reinforcement: "#9B8CE8",
        focus: "#1A2C4F",
        // Memory states
        active: "#3EC07B",
        fading: "#F5A89C",
        archived: "#C5C3BE",
        // Semantic
        danger: "#B04A38",
      },
      fontFamily: {
        sans: ["Inter_400Regular", "system-ui", "sans-serif"],
        medium: ["Inter_500Medium"],
        semibold: ["Inter_600SemiBold"],
        bold: ["Inter_700Bold"],
      },
      fontSize: {
        // Type scale calibrated from the Memora App.html mockup
        "xs-tight": ["10.5px", { lineHeight: "14px", letterSpacing: "0.16em" }],
        micro: ["11px", { lineHeight: "15px" }],
        caption: ["12px", { lineHeight: "16px" }],
        body: ["13.5px", { lineHeight: "20px" }],
        "body-lg": ["14.5px", { lineHeight: "22px" }],
        cta: ["16px", { lineHeight: "22px", letterSpacing: "-0.01em" }],
        h2: ["19px", { lineHeight: "24px", letterSpacing: "-0.02em" }],
        h1: ["30px", { lineHeight: "33px", letterSpacing: "-0.03em" }],
        display: ["44px", { lineHeight: "48px", letterSpacing: "-0.035em" }],
      },
      borderRadius: {
        card: "14px",
        pill: "999px",
        chip: "10px",
      },
      boxShadow: {
        cta: "0 6px 18px -8px rgba(26,44,79,0.4)",
        toast: "0 16px 40px -12px rgba(26,44,79,0.4)",
        card: "0 14px 32px -16px rgba(26,44,79,0.22)",
      },
    },
  },
  plugins: [],
};
