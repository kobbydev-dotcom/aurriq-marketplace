import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";

export default defineConfig({
  plugins: [react(), tailwindcss()],

  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },

  build: {
    chunkSizeWarningLimit: 1200,        // Increased limit
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom', 'react-router-dom'],
          convex: ['convex/react'],
          // Add more if needed later
        }
      }
    }
  },

  preview: {
    allowedHosts: ["aurriq-marketplace-live-a04ea8311137.herokuapp.com"],
  },
});