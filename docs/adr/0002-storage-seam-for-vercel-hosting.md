# ADR-0002: A storage seam so the app can run on Vercel

Status: accepted
Date: 2026-08-31

## Context

The app was built local-first: one long-running Express process reading and
writing `data/*.json` and `data/icons/` on disk, with the UI served through
Vite middleware. The player now also plays on other devices and wants the
app hosted. Vercel was chosen, and Vercel runs no persistent servers: the
UI must be a static build, the API a serverless function, and the
filesystem is read-only and per-instance, which breaks every disk write the
Refresh pipeline does.

Persistent hosts (Railway, Render, a VPS) would have run the app unchanged,
but Vercel's free tier and zero-maintenance deploys won.

## Decision

All persistence goes behind a `Storage` interface (`src/server/storage.ts`)
with two implementations: disk (local dev, tests, unchanged on-disk layout)
and Vercel Blob (`blobStorage.ts`, JSON documents under `data/`, icons
under `icons/`, fixed pathnames overwritten in place). `createApp` takes
either a `dataDir` shorthand or a `Storage`, and nothing else in the server
touches `fs` or Blob APIs.

Three behaviors moved with the seam:

- Icon URLs are whatever the storage returns: relative `/icons/...` paths
  the app serves itself from disk, or absolute Blob CDN URLs. The payload
  contract (absent icon field means fallback tile) is unchanged.
- The Refresh outcome persists as `refresh-state.json` beside the data,
  because serverless instances share nothing in memory: without it, a
  failed Refresh on one instance would leave every other instance claiming
  the data is fine. On disk this also means degraded mode now survives a
  server restart, which is more honest, not less.
- The lazy 24-hour Refresh trigger is kept as the only trigger. The first
  request after a day of quiet pays for the Refresh inline (the function
  gets 60 seconds; a full Refresh takes well under 10).

Deployment shape: the build esbuild-bundles `src/server/vercelEntry.ts`,
dependencies inlined, into `api/app.bundle.mjs`; the committed function
entry `api/index.ts` only re-exports it. `vercel.json` rewrites `/api/*`
to that single function, and the UI deploys as the static `vite build`
output. The pre-bundling is not optional: Vercel's Node builder ships the
entry type-stripped without compiling what it imports, so a function that
imports `src/` directly dies at startup (api/README.md has the details).

## Consequences

- Local dev, the tests, and the offline-first promise are untouched: the
  disk implementation reproduces the previous behavior byte for byte, and
  the whole suite still runs against it. New seam tests pin the storage
  contract with an in-memory implementation, so the Blob code has a spec
  without the suite ever talking to Blob.
- Blob's CDN can serve an overwritten document's previous bytes for up to
  a minute. Reads version every fetch with the blob's `uploadedAt`, and a
  writing instance trusts its own copy past that window, so the stale case
  is confined to a different instance within a minute of a Refresh.
- The hosted app depends on network at render time (Blob URLs for icons).
  The offline guarantee only ever applied to the local server, and still
  holds there.
- The Blob implementation is not covered by the automated suite; it is
  verified by deploying. That is the same trade the live fetcher already
  makes.
