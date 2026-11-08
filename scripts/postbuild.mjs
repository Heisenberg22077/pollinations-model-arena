import { copyFile } from "node:fs/promises";

// Pages uses this entry point for deep links; assets retain Vite's configured base.
await copyFile(
  new URL("../dist/index.html", import.meta.url),
  new URL("../dist/404.html", import.meta.url),
);
