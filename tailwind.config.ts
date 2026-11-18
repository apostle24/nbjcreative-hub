import type { Config } from "tailwindcss";
const config: Config = {
  content: ["./app/**/*.{js,ts,jsx,tsx,mdx}", "./components/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: { extend: {
    colors: { ink: "#14263D", teal: "#167D82", mist: "#F4F7F8", muted: "#667586" },
    boxShadow: { soft: "0 14px 45px rgba(20,38,61,.08)" }
  }},
  plugins: []
};
export default config;