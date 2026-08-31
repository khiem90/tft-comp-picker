import { build } from "esbuild";

// Bundles the Vercel function body (see api/README.md). Express and the
// Blob SDK are CommonJS underneath, so the ESM output needs a real require
// for their built-in module loads; the banner provides one.
await build({
  entryPoints: ["src/server/vercelEntry.ts"],
  bundle: true,
  platform: "node",
  target: "node20",
  format: "esm",
  outfile: "api/app.bundle.mjs",
  banner: {
    js: "import { createRequire } from 'node:module'; const require = createRequire(import.meta.url);",
  },
});
