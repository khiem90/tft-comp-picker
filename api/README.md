# Vercel function directory

`index.ts` is the whole hosted API: vercel.json rewrites every `/api/*`
request to it and the Express app routes on the original path.

The `package.json` here pins this directory to CommonJS on purpose. With
the repo root's `"type": "module"`, Vercel's Node builder compiles the
function entry as an ES module without transpiling or bundling the
`src/server` files it imports, and the function then dies at import time
with ERR_MODULE_NOT_FOUND (`/var/task/src/server/app`). Marking the
directory CommonJS switches the builder to its bundling path, which
compiles the whole import graph. Nothing the function imports needs ESM;
only the local-dev entry `src/server/main.ts` does, and it is not part of
this graph.
