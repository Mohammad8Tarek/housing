import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

const rawPort = process.env.PORT || "9000";

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

// API server port (backend)
const apiPort = process.env.API_PORT ? Number(process.env.API_PORT) : 4000;

export default defineConfig({
  base: "/",
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
      "@workspace/dates": path.resolve(
        import.meta.dirname,
        "..",
        "..",
        "lib",
        "dates",
        "src",
      ),
      "@assets": path.resolve(
        import.meta.dirname,
        "..",
        "..",
        "attached_assets",
      ),
    },
    dedupe: ["react", "react-dom", "@tanstack/react-query"],
  },
  root: path.resolve(import.meta.dirname),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
    chunkSizeWarningLimit: 3000,
    rollupOptions: {
      onwarn(warning, warn) {
        if (warning.message.includes("Error when using sourcemap")) return;
        warn(warning);
      },
      output: {
        // Split the stable framework libraries into a dedicated, long-cached
        // vendor chunk so an app-code change doesn't bust React's cache on the
        // entry chunk (loaded on every visit).
        manualChunks(id) {
          if (!id.includes("node_modules")) return undefined;
          if (
            /[\\/]node_modules[\\/](react|react-dom|scheduler|react-is)[\\/]/.test(
              id,
            )
          ) {
            return "vendor-react";
          }
          if (
            /[\\/]node_modules[\\/](@tanstack[\\/]react-query|wouter|next-themes)[\\/]/.test(
              id,
            )
          ) {
            return "vendor-core";
          }
          return undefined;
        },
      },
    },
  },
  server: {
    port,
    host: "0.0.0.0",
    allowedHosts: true,
    headers: {
      "X-Content-Type-Options": "nosniff",
    },
    hmr: { overlay: false },
    fs: {
      strict: false,
    },
    proxy: {
      "/api": {
        target: `http://localhost:${apiPort}`,
        changeOrigin: true,
        secure: false,
      },
      "/ws": {
        target: `http://localhost:${apiPort}`,
        ws: true,
        changeOrigin: true,
        secure: false,
      },
    },
  },
  preview: {
    port,
    host: "0.0.0.0",
    allowedHosts: true,
    headers: {
      "X-Content-Type-Options": "nosniff",
    },
    proxy: {
      "/api": {
        target: `http://localhost:${apiPort}`,
        changeOrigin: true,
        secure: false,
      },
      "/ws": {
        target: `http://localhost:${apiPort}`,
        ws: true,
        changeOrigin: true,
        secure: false,
      },
    },
  },
});
