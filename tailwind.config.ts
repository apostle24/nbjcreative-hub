import type { Config } from "tailwindcss";
const config: Config = {
  content: ["./app/**/*.{js,ts,jsx,tsx,mdx}", "./components/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: { extend: {
    colors: { ink: "#171536", teal: "#7048EF", mist: "#F5F3FF", muted: "#686681" },
    boxShadow: { soft: "0 16px 48px rgba(48,32,110,.10)" }
  }},
  plugins: []
};
export default config;
