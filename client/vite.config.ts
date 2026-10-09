import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const serverTarget = "http://localhost:3000";

export default defineConfig({
  plugins: [react()],
  server: {
    host: "0.0.0.0",
    port: 5173,
    strictPort: true,
    proxy: {
      "/api": {
        target: serverTarget,
        changeOrigin: true,
      },
      "/socket.io": {
        target: serverTarget,
        changeOrigin: true,
        ws: true,
      },
    },
  },
});
