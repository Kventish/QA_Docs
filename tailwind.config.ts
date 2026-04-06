import type { Config } from "tailwindcss";

export default {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        surface: {
          0: "#0B1220",
          1: "#0F172A",
          2: "#111C33"
        },
        text: {
          primary: "#E5E7EB",
          muted: "#A3AAB8"
        },
        brand: {
          500: "#6D5EF9",
          600: "#5B4DF1"
        },
        border: "#22304A"
      },
      boxShadow: {
        soft: "0 8px 30px rgba(0,0,0,0.35)"
      }
    }
  },
  plugins: []
} satisfies Config;

