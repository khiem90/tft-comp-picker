import path from "node:path";
import { fileURLToPath } from "node:url";
import { createServer as createViteServer } from "vite";
import { createApp } from "./app";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

const app = createApp({ dataDir: path.join(rootDir, "data") });

const vite = await createViteServer({
  root: rootDir,
  server: { middlewareMode: true },
  appType: "spa",
});
app.use(vite.middlewares);

const port = Number(process.env.PORT ?? 3000);
app.listen(port, () => {
  console.log(`TFT Comp Picker running at http://localhost:${port}`);
});
