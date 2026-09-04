import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "node:path";

// The Tailwind v4 plugin is only needed when building CSS (dev/build), not when
// serving the prebuilt dist via `vite preview`. It's a devDependency (pruned on
// Heroku after build), so lazy-load it only for non-preview commands.
const isPreview = process.env.npm_lifecycle_event === "preview:heroku";
const tailwind = isPreview
  ? null
  : (await import("@tailwindcss/vite")).default();

export default defineConfig({
  plugins: [react(), ...(tailwind ? [tailwind] : [])],

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