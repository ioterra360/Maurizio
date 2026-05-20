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
        // Memora editorial palette (mirrors theme/tokens.ts).
        navy: "#1A2C4F",
        canvas: "#F5F3EF",
        "warm-white": "#FAF8F4",
        surface: "#FFFFFF",
        "mid-grey": "#8A8A88",
        placeholder: "#B5B3AE",
        hairline: "rgba(26,44,79,0.08)",
        "hairline-strong": "rgba(26,44,79,0.14)",
        divider: "#EFEDE7",
        // Layers (Scan → Reinforcement → Focus, locked order).
        scan: "#6DA8E5",
        reinforcement: "#9B8CE8",
        focus: "#1A2C4F",
        // Memory states.
        active: "#3EC07B",
        fading: "#F5A89C",
        archived: "#C5C3BE",
        // Semantic.
        danger: "#B04A38",
        "danger-soft": "#FDEEEA",
        // Tag chip backgrounds.
        "tag-user": "#EDF0F6",
      },
      fontFamily: {
        sans: ["Inter_400Regular", "system-ui", "sans-serif"],
        "inter-medium": ["Inter_500Medium"],
        "inter-semibold": ["Inter_600SemiBold"],
        "inter-bold": ["Inter_700Bold"],
      },
      fontSize: {
        // Type scale calibrated from Memora App.html.
        "xs-tight": ["10.5px", { lineHeight: "13px", letterSpacing: "0.14em" }],
        "xs-tag":   ["10.5px", { lineHeight: "13px", letterSpacing: "0.08em" }],
        micro: ["11px", { lineHeight: "15px" }],
        caption: ["12px", { lineHeight: "16px" }],
        body: ["13.5px", { lineHeight: "20px" }],
        "body-lg": ["14.5px", { lineHeight: "22px" }],
        cta: ["16px", { lineHeight: "22px", letterSpacing: "-0.01em" }],
        // Line heights bumped to ≥1.25× font-size so descenders (g, y, p)
        // don't clip on the editorial-style hero headers.
        h2: ["19px", { lineHeight: "26px", letterSpacing: "-0.02em" }],
        h1: ["30px", { lineHeight: "38px", letterSpacing: "-0.03em" }],
        display: ["44px", { lineHeight: "54px", letterSpacing: "-0.035em" }],
      },
      borderRadius: {
        tag: "6px",
        input: "12px",
        cta: "14px",
        card: "14px",
        chip: "10px",
        filter: "8px",
        pill: "999px",
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
