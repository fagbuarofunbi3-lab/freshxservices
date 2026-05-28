// Post-build: package dist/ into .vercel/output following the Vercel Build Output API v3.
// The TanStack Start build produces:
//   dist/client/  → static assets
//   dist/server/server.js  → Web fetch handler ({ default: { fetch(req) } })
// We wrap that handler as a Vercel Edge Function and serve dist/client as static.
import { cp, mkdir, rm, writeFile, readdir, stat } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, resolve } from "node:path";

const root = resolve(process.cwd());
const distDir = join(root, "dist");
const clientDir = join(distDir, "client");
const serverDir = join(distDir, "server");
const outDir = join(root, ".vercel", "output");
const staticDir = join(outDir, "static");
const fnDir = join(outDir, "functions", "index.func");

if (!existsSync(clientDir) || !existsSync(serverDir)) {
  console.error("[vercel-build] dist/client or dist/server missing — did `vite build` run?");
  process.exit(1);
}

await rm(outDir, { recursive: true, force: true });
await mkdir(staticDir, { recursive: true });
await mkdir(fnDir, { recursive: true });

// 1) Static assets
await cp(clientDir, staticDir, { recursive: true });

// 2) Edge function bundle — copy the whole server output so relative chunk imports resolve.
await cp(serverDir, fnDir, { recursive: true });

// Entry that re-exports the fetch handler as the Edge function default export.
await writeFile(
  join(fnDir, "entry.js"),
  `import handler from "./server.js";\nexport default handler.fetch;\n`,
);

await writeFile(
  join(fnDir, ".vc-config.json"),
  JSON.stringify(
    {
      runtime: "edge",
      entrypoint: "entry.js",
    },
    null,
    2,
  ),
);

// 3) Top-level config — serve static files first, then fall through to the function.
const staticEntries = await readdir(staticDir);
const staticRoutes = [];
for (const name of staticEntries) {
  const full = join(staticDir, name);
  const s = await stat(full);
  if (s.isDirectory()) {
    staticRoutes.push({ src: `^/${name}/(.*)$`, headers: { "cache-control": "public, max-age=31536000, immutable" }, continue: true });
  }
}

await writeFile(
  join(outDir, "config.json"),
  JSON.stringify(
    {
      version: 3,
      routes: [
        ...staticRoutes,
        { handle: "filesystem" },
        { src: "/(.*)", dest: "/index" },
      ],
    },
    null,
    2,
  ),
);

console.log("[vercel-build] .vercel/output ready");
