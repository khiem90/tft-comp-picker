import { createApp } from "../src/server/app";
import { createBlobStorage } from "../src/server/blobStorage";
import { createLiveFetcher } from "../src/server/sources";

// The Vercel deployment's one function: vercel.json rewrites every /api/*
// request here, and the Express app routes on the original path. The UI is
// the static Vite build, not served by this function, and icons resolve to
// Blob URLs so no /icons route is needed. Warm instances reuse the app and
// its document cache; the lazy 24-hour Refresh trigger works unchanged.
const app = createApp({
  storage: createBlobStorage(),
  fetcher: createLiveFetcher(),
});

export default app;
