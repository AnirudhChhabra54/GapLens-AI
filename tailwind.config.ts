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
        background: "#0B0F19",
        surface: "#111827",
        "surface-raised": "#1F2937",
        border: "#1E293B",
        primary: {
          DEFAULT: "#2563EB", // Electric blue
          foreground: "#FFFFFF",
          hover: "#1D4ED8",
        },
        accent: {
          DEFAULT: "#14B8A6", // Teal
          foreground: "#0F172A",
          hover: "#0D9488",
        },
        mastery: {
          weak: "#EF4444", // Red (<55%)
          medium: "#F59E0B", // Amber (55-79%)
          strong: "#10B981", // Emerald (>=80%)
          unassessed: "#64748B", // Slate
        },
        blindspot: {
          badge: "#DC2626",
          bg: "#450A0A",
          border: "#991B1B",
        },
      },
      borderRadius: {
        lg: "0.5rem",
        md: "0.375rem",
        sm: "0.25rem",
      },
    },
  },
  plugins: [],
};

export default config;
