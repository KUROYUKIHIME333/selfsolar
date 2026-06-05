import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true, // Permet d'utiliser 'describe', 'it', 'expect' sans les importer
    environment: "node",
    include: ["src/**/*.tests.ts"], // Chemin vers tes fichiers de tests
  },
});
