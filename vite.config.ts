import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

// GitHub Pages serves the app from /<repo-name>/. Override with VITE_BASE if the repo is named differently.
const base = process.env.VITE_BASE ?? (process.env.GITHUB_ACTIONS ? "/dayflow/" : "/");

export default defineConfig({
  base,
  server: { port: 5173, strictPort: true },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          react: ["react", "react-dom", "react-router-dom"],
          charts: ["chart.js", "react-chartjs-2"],
          supabase: ["@supabase/supabase-js"],
        },
      },
    },
  },
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.svg"],
      manifest: {
        name: "DAYFLOW",
        short_name: "DAYFLOW",
        description: "Organize your days. Take care of yourself. Make progress at your own pace.",
        theme_color: "#111722",
        background_color: "#111722",
        display: "standalone",
        start_url: ".",
        scope: ".",
        icons: [
          { src: "icons/icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "icons/icon-512.png", sizes: "512x512", type: "image/png" },
          { src: "icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
      workbox: { globPatterns: ["**/*.{js,css,html,svg,png,woff2}"], navigateFallbackDenylist: [/^\/auth/] },
    }),
  ],
  test: { environment: "node", include: ["src/**/*.test.ts"] },
});
