import { sveltekit } from "@sveltejs/kit/vite"
import { defineConfig } from "vite"

export default defineConfig({
  plugins: [sveltekit()],
  server: {
    // forward API calls to @template/server during development
    proxy: {
      "/health": "http://localhost:3000",
      "/problem": "http://localhost:3000",
      "/openapi.json": "http://localhost:3000",
    },
  },
})
