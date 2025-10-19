import type { Config } from "tailwindcss";
import animate from "tailwindcss-animate";
import typography from "@tailwindcss/typography";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
    "./pages/**/*.{ts,tsx}",
    "./src/**/*.{ts,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        background: "#07070f",
        foreground: "#f2f2f7",
        primary: {
          DEFAULT: "#7c4dff",
          foreground: "#ffffff"
        },
        muted: {
          DEFAULT: "#111221",
          foreground: "#a5a7d4"
        },
        accent: {
          DEFAULT: "#1f223a",
          foreground: "#f2f2f7"
        }
      },
      fontFamily: {
        heading: ["'Poppins'", "sans-serif"],
        body: ["'Inter'", "sans-serif"]
      },
      boxShadow: {
        soft: "0 20px 45px rgba(18, 21, 64, 0.35)"
      },
      backgroundImage: {
        "grid-fade":
          "radial-gradient(circle at top right, rgba(124, 77, 255, 0.35), transparent 55%), radial-gradient(circle at bottom left, rgba(255, 255, 255, 0.08), transparent 60%)"
      }
    }
  },
  plugins: [animate, typography]
};

export default config;
