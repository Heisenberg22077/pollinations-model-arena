/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "rgb(var(--ink) / <alpha-value>)",
        ink2: "#191611",
        control: "#0e0d0b",
        paper: "#f8f1e3",
        acid: "rgb(var(--accent) / <alpha-value>)",
        orange: "rgb(var(--orange) / <alpha-value>)",
        cobalt: "#4d5bff",
        muted: "#8b8d82",
        canvas: "rgb(var(--canvas) / <alpha-value>)",
        surface: "rgb(var(--surface) / <alpha-value>)",
        raised: "rgb(var(--raised) / <alpha-value>)",
        foreground: "rgb(var(--foreground) / <alpha-value>)",
        quiet: "rgb(var(--quiet) / <alpha-value>)",
        "accent-ink": "rgb(var(--accent-ink) / <alpha-value>)",
        sage: "#e2f1e8",
        "sage-ink": "#326348",
        line: "rgba(39, 33, 23, 0.14)",
      },
      fontFamily: {
        display: ['"Geist Pixel"', "monospace"],
        sans: ['"Geist Sans"', "system-ui", "sans-serif"],
        mono: ['"Geist Mono"', "ui-monospace", "SFMono-Regular", "Consolas", "monospace"],
      },
      boxShadow: {
        stamp: "none",
        "stamp-acid": "none",
        card: "none",
      },
      keyframes: {
        rise: {
          "0%": { opacity: "0", transform: "translateY(10px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        shimmer: {
          "0%": { transform: "translateX(-100%)" },
          "100%": { transform: "translateX(200%)" },
        },
        scan: {
          "0%": { top: "0%" },
          "50%": { top: "92%" },
          "100%": { top: "0%" },
        },
        blink: {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.25" },
        },
      },
      animation: {
        rise: "rise 0.3s cubic-bezier(0.22, 1, 0.36, 1) both",
        shimmer: "shimmer 1.5s linear infinite",
        scan: "scan 1.8s ease-in-out infinite",
        blink: "blink 1.1s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};
