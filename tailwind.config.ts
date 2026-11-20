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
        canvas: "#F7F5F0",
        surface: {
          DEFAULT: "#FFFEFC",
          subtle: "#F2EFE8",
          muted: "#EAE6DE",
          elevated: "#FFFFFF",
        },
        brandText: {
          primary: "#252A2E",
          secondary: "#5E666A",
          muted: "#687176",
        },
        brandBorder: {
          DEFAULT: "#E2DED6",
          strong: "#CFC8BD",
        },
        accent: {
          DEFAULT: "#4C6477",
          hover: "#3C5264",
          soft: "#E9EFF2",
          foreground: "#FFFFFF",
        },
        warm: {
          DEFAULT: "#85553F",
          soft: "#F3E8E1",
          hover: "#6E4532",
        },
        status: {
          success: "#356A57",
          successSoft: "#E7F0EA",
          warning: "#8B5E1A",
          warningSoft: "#F5EEDC",
          danger: "#8E4E4A",
          dangerSoft: "#F5E8E6",
          info: "#4C6477",
          infoSoft: "#E9EFF2",
        },
        // Semantic masteries
        mastery: {
          weak: "#8E4E4A",
          medium: "#8B5E1A",
          strong: "#356A57",
          unassessed: "#687176",
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
        serif: [
          '"Newsreader"',
          '"New York"',
          "Georgia",
          "Cambria",
          '"Times New Roman"',
          "serif",
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
      },
      borderRadius: {
        control: "6px",
        card: "10px",
        panel: "14px",
        feature: "18px",
      },
      boxShadow: {
        subtle: "0 1px 3px rgba(37, 42, 46, 0.05)",
        card: "0 2px 8px rgba(37, 42, 46, 0.04), 0 1px 2px rgba(37, 42, 46, 0.02)",
        menu: "0 8px 24px rgba(37, 42, 46, 0.08)",
        dialog: "0 16px 48px rgba(37, 42, 46, 0.12)",
      },
    },
  },
  plugins: [],
};

export default config;
