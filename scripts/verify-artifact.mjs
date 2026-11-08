import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { gzipSync } from "node:zlib";

const index = await readFile("dist/index.html", "utf8");
assert.equal(await readFile("dist/404.html", "utf8"), index);
const assets = [...index.matchAll(/(?:src|href)="(\/[^"]+)"/g)].map((match) => match[1]);
const pages = index.includes("/pollinations-model-arena/assets/");
const base = pages ? "/pollinations-model-arena/" : "/";
for (const asset of assets) {
  assert(asset.startsWith(base));
  await readFile(`dist/${asset.slice(base.length)}`);
}
const manifest = JSON.parse(await readFile("dist/manifest.webmanifest", "utf8"));
assert.equal(manifest.start_url, "./");
for (const icon of manifest.icons) {
  const data = await readFile(`dist/${icon.src}`);
  assert.equal(`${data.readUInt32BE(16)}x${data.readUInt32BE(20)}`, icon.sizes);
}
const og = await readFile("dist/og.png");
assert.equal(og.readUInt32BE(16), 1200);
assert.equal(og.readUInt32BE(20), 630);

let jsGzipBytes = 0;
let cssGzipBytes = 0;
const fonts = new Set();
for (const name of await readdir("dist/assets")) {
  const data = await readFile(`dist/assets/${name}`);
  const text = data.toString("utf8");
  if (name.endsWith(".js")) {
    assert(
      !/(sk_|ghp_)[A-Za-z0-9_-]{16,}/.test(text),
      "Unexpected credential in application bundle.",
    );
    jsGzipBytes += gzipSync(data).length;
  }
  if (!name.endsWith(".css")) continue;
  cssGzipBytes += gzipSync(data).length;
  for (const match of text.matchAll(/url\(["']?([^"')]+)["']?\)/g)) {
    const url = match[1];
    if (/^(data:|https?:|#)/.test(url)) continue;
    assert(url.startsWith(base), `Incorrect stylesheet base: ${url}`);
    const asset = await readFile(`dist/${url.slice(base.length)}`);
    if (url.endsWith(".woff2")) {
      assert.equal(asset.toString("ascii", 0, 4), "wOF2");
      fonts.add(url);
    }
  }
}
assert(jsGzipBytes < 150_000, `Application JavaScript exceeds 150,000 gzip bytes: ${jsGzipBytes}`);
assert.equal(fonts.size, 3);

const provenance = JSON.parse(await readFile("dist/art/PROVENANCE.json", "utf8"));
assert.equal(provenance.assets.length, 8);
for (const asset of provenance.assets) {
  const bytes = await readFile(`dist/art/${asset.file}`);
  assert.equal(bytes.toString("ascii", 0, 4), "RIFF");
  assert.equal(bytes.toString("ascii", 8, 12), "WEBP");
  assert.equal(bytes.length, asset.bytes);
  const blob = createHash("sha1").update(`blob ${bytes.length}\0`).update(bytes).digest("hex");
  assert.equal(blob, asset.blob, `Reference artwork bytes changed: ${asset.file}`);
}
await readFile("dist/art/POLLINATIONS-LICENSE.txt");
await readFile("dist/fonts/Geist-OFL.txt");
await readFile("dist/licenses/LIBRARIES.txt");
const report = {
  base,
  identical404: true,
  jsGzipBytes,
  cssGzipBytes,
  fonts: [...fonts],
  originalGardenAssets: provenance.assets.length,
  icons: "192 and 512 pixels",
  socialPreview: "1200×630",
  embeddedCredentials: 0,
};
await mkdir(".local", { recursive: true });
await writeFile(
  `.local/artifact-${pages ? "pages" : "root"}.json`,
  JSON.stringify(report, null, 2),
);
console.log(JSON.stringify(report, null, 2));
