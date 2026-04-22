import { defineConfig } from "astro/config";
import node from "@astrojs/node";
import react from "@astrojs/react";
import tailwindcss from "@tailwindcss/vite";
import vercel from '@astrojs/vercel';

export default defineConfig({
  output: "static",
  adapter: vercel({
    edge: true,
  }),
  integrations: [react()],
  vite: {
    plugins: [tailwindcss()],
  },
});
