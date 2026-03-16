import { defineConfig } from "vite";
import { resolve } from "node:path";

export default defineConfig({
  server: {
    port: 5173,
    host: "0.0.0.0",
    proxy: {
      "/api": {
        target: "http://localhost:8080",
        changeOrigin: true
      }
    }
  },
  build: {
    rollupOptions: {
      input: {
        index: resolve(__dirname, "index.html"),
        login: resolve(__dirname, "login.html"),
        signup: resolve(__dirname, "signup.html"),
        student: resolve(__dirname, "student.html"),
        teacher: resolve(__dirname, "teacher.html"),
        admin: resolve(__dirname, "admin.html")
      }
    }
  }
});
