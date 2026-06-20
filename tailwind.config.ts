import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        ink: "#172033",
        line: "#d1d5db",
        mist: "#f7f8fa",
        forest: "#0F766E",
        teal: "#14B8A6",
        coral: "#DC2626",
        amber: "#D97706",
        success: "#16A34A",
      },
      maxWidth: {
        app: "1280px",
      },
      borderRadius: {
        DEFAULT: "8px",
        md: "8px",
        lg: "8px",
        xl: "8px",
      },
      boxShadow: {
        panel: "0 1px 2px rgba(15, 23, 42, 0.06)",
      },
    },
  },
  plugins: [],
};

export default config;
