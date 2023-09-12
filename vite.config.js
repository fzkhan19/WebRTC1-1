// vite.config.js
import { defineConfig } from "vite";
import { createServer } from "vite";

export default defineConfig({
  server: {
    https: {
      key: "key.pem", // Path to your SSL key file
      cert: "cert.pem", // Path to your SSL certificate file
    },
  },
});
