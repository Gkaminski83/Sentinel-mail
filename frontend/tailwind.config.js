/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx}",
    "./pages/**/*.{js,ts,jsx,tsx}",
    "./src/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
    "./lib/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "#070E1C",
        panel: "#0C1630",
        accent: "#00D1FF",
        text: "#E6F0FF",
        muted: "#7A8CA5",
      },
      fontFamily: {
        sans: ["'Inter'", "'Space Grotesk'", "system-ui", "sans-serif"],
      },
      boxShadow: {
        glow: "0 20px 60px rgba(0, 209, 255, 0.2)",
      },
      animation: {
        "pulse-subtle": "pulse-subtle 1.8s ease-in-out infinite",
      },
      keyframes: {
        "pulse-subtle": {
          "0%, 100%": { opacity: 0.4 },
          "50%": { opacity: 0.9 },
        },
      },
    },
  },
  plugins: [],
};
