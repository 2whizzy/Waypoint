import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        pine: {
          50: "#EDF5F2",
          100: "#D6E8E2",
          200: "#A8CEC3",
          300: "#75B0A0",
          400: "#3E8A76",
          500: "#1F6F5C",
          600: "#175E54",
          700: "#124A42",
          800: "#0E3832",
          900: "#0A2723",
        },
        marigold: {
          100: "#FBEFD3",
          200: "#F4DC9E",
          300: "#E9C35B",
          400: "#D9A514",
          500: "#B8890D",
          600: "#8F6A0A",
        },
        paper: {
          DEFAULT: "#F6F5F0",
          raised: "#FDFCF9",
          sunken: "#EDEBE3",
          line: "#E0DDD2",
        },
        ink: {
          DEFAULT: "#20241F",
          soft: "#4D534C",
          faint: "#7C837B",
        },
        clay: {
          100: "#F7E3E1",
          400: "#C4564E",
          600: "#A33B34",
        },
      },
      fontFamily: {
        display: ["var(--font-display)", "Georgia", "serif"],
        sans: ["var(--font-body)", "system-ui", "sans-serif"],
      },
      boxShadow: {
        card: "0 1px 2px rgba(32,36,31,0.06), 0 4px 16px rgba(32,36,31,0.06)",
        lift: "0 2px 4px rgba(32,36,31,0.08), 0 12px 32px rgba(32,36,31,0.12)",
      },
      borderRadius: {
        card: "0.875rem",
      },
    },
  },
  plugins: [],
};
export default config;
