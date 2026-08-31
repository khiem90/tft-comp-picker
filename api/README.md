# Vercel function directory

`index.ts` is the function entry Vercel deploys; vercel.json rewrites every
`/api/*` request to it. It only re-exports `app.bundle.mjs`, which
`npm run build` generates by esbuild-bundling `src/server/vercelEntry.ts`
with every dependency inlined. The bundle is gitignored.

The indirection exists because Vercel's Node builder does not compile what
the entry imports: it type-strips `api/index.ts` and ships the result, so a
relative import of `../src/server/app` reaches the runtime verbatim and
dies with ERR_MODULE_NOT_FOUND (and pinning this directory to CommonJS only
changes the error to "Cannot use import statement outside a module"). A
self-contained pre-built bundle sidesteps the builder entirely; the entry's
one remaining import names a real file with an explicit extension, which
both the file tracer and Node's ESM loader resolve fine.
