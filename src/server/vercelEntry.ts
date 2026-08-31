import { createApp } from "./app";
import { createBlobStorage } from "./blobStorage";
import { createLiveFetcher } from "./sources";

// The hosted deployment's whole API: vercel.json rewrites every /api/*
// request to the one function, and the Express app routes on the original
// path. Storage is Vercel Blob; the UI is served statically from the Vite
// build, and icons resolve to Blob URLs so no /icons route is needed. Warm
// instances reuse the app and its document cache; the lazy 24-hour Refresh
// trigger works unchanged.
//
// This file is not the function entry Vercel sees. The build bundles it
// (dependencies and all) into api/app.bundle.mjs, which api/index.ts
// re-exports; see api/README.md for why the indirection exists.
const app = createApp({
  storage: createBlobStorage(),
  fetcher: createLiveFetcher(),
});

export default app;
