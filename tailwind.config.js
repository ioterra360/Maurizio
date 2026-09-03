/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,jsx,ts,tsx}",
    "./components/**/*.{js,jsx,ts,tsx}",
    "./features/**/*.{js,jsx,ts,tsx}",
  ],
  presets: [require("nativewind/preset")],
  // Tema deciso da theme/theme-store.ts via colorScheme.set(): dalla build 3
  // (userInterfaceStyle "automatic") segue davvero il sistema.
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        // Memika palette — variabili di global.css, tema chiaro/scuro
        // (2026-09-02). I valori vivono in theme/palettes.ts + global.css.
        navy: "var(--mk-text-primary)",
        "navy-soft": "var(--mk-navy-soft)",
        canvas: "var(--mk-canvas)",
        "warm-white": "var(--mk-bg-screen)",
        surface: "var(--mk-surface)",
        "mid-grey": "var(--mk-text-secondary)",
        placeholder: "var(--mk-placeholder)",
        hairline: "var(--mk-hairline)",
        "hairline-strong": "var(--mk-hairline-strong)",
        divider: "var(--mk-divider)",
        "dot-idle": "var(--mk-dot-idle)",
        // Ruoli nuovi (spec 2026-09-02 §F1).
        accent: "var(--mk-accent)",
        "on-accent": "var(--mk-on-accent)",
        // Layers (Scan → Reinforcement → Focus, locked order).
        scan: "var(--mk-scan)",
        reinforcement: "var(--mk-reinforcement)",
        focus: "var(--mk-focus)",
        // Memory states.
        active: "var(--mk-active)",
        fading: "var(--mk-fading)",
        archived: "var(--mk-archived)",
        // Semantic.
        danger: "var(--mk-danger)",
        "danger-soft": "var(--mk-danger-soft)",
        // Tag chip backgrounds.
        "tag-user": "var(--mk-tag-user)",
        "tag-pro": "var(--mk-tag-pro)",
        "tag-pro-text": "var(--mk-tag-pro-text)",
      },
      fontFamily: {
        sans: ["Inter_400Regular", "system-ui", "sans-serif"],
        "inter-medium": ["Inter_500Medium"],
        "inter-semibold": ["Inter_600SemiBold"],
        "inter-bold": ["Inter_700Bold"],
      },
      fontSize: {
        // Type scale — enlarged across the board (2026-06-25) for readability;
        // line-heights kept ≥1.25× so descenders (g, y, p) don't clip.
        // Tracking labels (xs-*) left small on purpose — bumping them breaks
        // chip/tag layouts; the readable text (caption→display) all grew.
        "xs-tight": ["11px", { lineHeight: "14px", letterSpacing: "0.14em" }],
        "xs-tag":   ["11px", { lineHeight: "14px", letterSpacing: "0.08em" }],
        micro: ["12px", { lineHeight: "16px" }],
        caption: ["13px", { lineHeight: "18px" }],
        body: ["15px", { lineHeight: "22px" }],
        "body-lg": ["16px", { lineHeight: "24px" }],
        cta: ["17.5px", { lineHeight: "24px", letterSpacing: "-0.01em" }],
        h2: ["21px", { lineHeight: "28px", letterSpacing: "-0.02em" }],
        h1: ["33px", { lineHeight: "41px", letterSpacing: "-0.03em" }],
        display: ["47px", { lineHeight: "57px", letterSpacing: "-0.035em" }],
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
