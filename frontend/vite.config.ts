import path from "node:path";
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";

const rootDir = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 3000,
    strictPort: true,
  },
  resolve: {
    alias: {
      "@": path.resolve(rootDir, "src"),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) return;

          if (id.includes("@heroui")) return "vendor-heroui";
          if (id.includes("@tanstack")) return "vendor-tanstack";
          if (id.includes("motion")) return "vendor-motion";
          if (id.includes("@hugeicons")) return "vendor-icons";
          if (id.includes("react-dom") || id.includes("/react/")) return "vendor-react";
        },
      },
    },
  },
});
