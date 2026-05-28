// @lovable.dev/vite-tanstack-config bundles the Cloudflare plugin by default.
// We disable it and target Vercel via TanStack Start's deployment target.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

export default defineConfig({
  cloudflare: false,
  tanstackStart: {
    target: "vercel",
    server: { entry: "server" },
  },
});
