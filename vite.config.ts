import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// GitHub Pages serves the repo under /pollinations-model-arena/, while
// Pollinations Sites serves it from the domain root. Override with VITE_BASE.
const base = process.env.VITE_BASE ?? "/";

export default defineConfig({
  base,
  plugins: [react()],
  build: {
    outDir: "dist",
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("/node_modules/lucide-react/")) return "vendor-lucide";
          // Runtime GSAP is CDN-owned; this branch also covers future bundled imports.
          if (id.includes("/node_modules/gsap/")) return "vendor-gsap";
        },
      },
    },
  },
});
