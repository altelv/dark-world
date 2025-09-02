import type { Config } from 'tailwindcss'
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: { extend: {
    colors: { ink:"#0c0b10", coal:"#15141b", iron:"#20202a", ash:"#8a8aa0", accent:"#9d4edd", gold:"#f1c40f" },
    boxShadow: { soft: "0 8px 24px rgba(0,0,0,0.35)" },
    borderRadius: { xl2: "1.25rem" }
  } },
  plugins: []
} satisfies Config
