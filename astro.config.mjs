import { defineConfig } from "astro/config";
import vercel from "@astrojs/vercel";

export default defineConfig({
  // Astro 7 defaults to compressHTML: "jsx" (JSX whitespace rules); keep the Astro 6 behaviour until the rendered spacing has been reviewed.
  compressHTML: true,
  output: "server",
  adapter: vercel({
    functionPerRoute: true,
    maxDuration: 10
  })
});
