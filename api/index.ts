// The function entry Vercel deploys. The real app lives in
// src/server/vercelEntry.ts; `npm run build` bundles it, dependencies and
// all, into app.bundle.mjs beside this file, and this entry only re-exports
// it. See README.md here for why the function cannot import src/ directly.
// This directory is excluded from tsconfig: the bundle only exists after a
// build, so the import cannot typecheck; vercelEntry.ts is typechecked.
import app from "./app.bundle.mjs";

export default app;
