import { defineConfig } from "cypress";

export default defineConfig({
  e2e: {
    baseUrl: "http://localhost:4321",
    supportFile: "cypress/support/e2e.ts",
    video: true,
    env: {
      ADMIN_EMAIL: process.env.CYPRESS_ADMIN_EMAIL,
      ADMIN_PASSWORD: process.env.CYPRESS_ADMIN_PASSWORD,
    },
  },
});
