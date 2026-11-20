import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "#080D0C",
        surface: {
          DEFAULT: "#0D1512",
          elevated: "#121D18",
          interactive: "#17231D",
          hover: "#1D2C24",
        },
        primary: {
          DEFAULT: "#00D6A0",
          foreground: "#080D0C",
          hover: "#00B887",
        },
        accent: {
          DEFAULT: "#00D6A0",
          mint: "#B7FFE8",
          foreground: "#080D0C",
          hover: "#00B887",
        },
        text: {
          main: "#F1F7F4",
          secondary: "#A0ADA6",
          muted: "#6D7C74",
        },
        border: {
          DEFAULT: "rgba(183, 255, 232, 0.08)",
          elevated: "rgba(183, 255, 232, 0.16)",
          active: "rgba(0, 214, 160, 0.40)",
        },
        mastery: {
          weak: "#F87171",
          medium: "#FBBF24",
          strong: "#00D6A0",
          unassessed: "#6D7C74",
        },
        blindspot: {
          badge: "#F87171",
          bg: "rgba(248, 113, 113, 0.08)",
          border: "rgba(248, 113, 113, 0.25)",
        },
      },
      fontFamily: {
        sans: [
          "-apple-system",
          "BlinkMacSystemFont",
          '"Segoe UI"',
          "Roboto",
          '"Helvetica Neue"',
          "Arial",
          "sans-serif",
        ],
        mono: [
          '"SF Mono"',
          "Menlo",
          "Monaco",
          "Consolas",
          '"Liberation Mono"',
          '"Courier New"',
          "monospace",
        ],
        serif: [
          '"New York"',
          "Georgia",
          "Cambria",
          '"Times New Roman"',
          "serif",
        ],
      },
      borderRadius: {
        xl: "0.75rem",
        "2xl": "1rem",
        "3xl": "1.5rem",
        full: "9999px",
      },
      boxShadow: {
        emerald: "0 0 24px -4px rgba(0, 214, 160, 0.25)",
        "emerald-lg": "0 0 40px -6px rgba(0, 214, 160, 0.35)",
        subtle: "0 4px 20px -2px rgba(0, 0, 0, 0.5)",
      },
    },
  },
  plugins: [],
};

export default config;
