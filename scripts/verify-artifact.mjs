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
const logoProvenance = JSON.parse(await readFile("dist/logos/PROVENANCE.json", "utf8"));
assert.equal(logoProvenance.assets.length, 12);
for (const asset of logoProvenance.assets) {
  const bytes = await readFile(`dist/logos/${asset.file}`);
  assert(bytes.toString("utf8").includes("viewBox="));
  assert.equal(bytes.length, asset.bytes);
  const blob = createHash("sha1").update(`blob ${bytes.length}\0`).update(bytes).digest("hex");
  assert.equal(blob, asset.blob, `Model logo bytes changed: ${asset.file}`);
  if (asset.sha256) {
    assert.equal(createHash("sha256").update(bytes).digest("hex"), asset.sha256);
  }
}
await readFile("dist/logos/LOBE-ICONS-LICENSE.txt");
const report = {
  verifiedModelLogos: logoProvenance.assets.length,
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
// Runtime CDN payload is separate from the application bundle budget.
const motionFiles = [
  "gsap.min.js",
  "Flip.min.js",
  "ScrollTrigger.min.js",
  "SplitText.min.js",
  "CustomEase.min.js",
];
let motionCdnRawBytes = 0;
let motionCdnGzipBytes = 0;
for (const name of motionFiles) {
  assert(index.includes(`https://cdn.jsdelivr.net/npm/gsap@3.15.1/dist/${name}`));
  const data = await readFile(`node_modules/gsap/dist/${name}`);
  motionCdnRawBytes += data.length;
  motionCdnGzipBytes += gzipSync(data).length;
}
assert(index.includes("https://unpkg.com/lenis@1.3.27/dist/lenis.min.js"));
assert(index.includes("https://unpkg.com/lenis@1.3.27/dist/lenis.css"));
for (const name of ["lenis.min.js", "lenis.css"]) {
  const data = await readFile(`node_modules/lenis/dist/${name}`);
  motionCdnRawBytes += data.length;
  motionCdnGzipBytes += gzipSync(data).length;
}
await readFile("dist/licenses/GSAP-STANDARD-LICENSE.md");
Object.assign(report, { motionCdnRawBytes, motionCdnGzipBytes });
await mkdir(".local", { recursive: true });
await writeFile(
  `.local/artifact-${pages ? "pages" : "root"}.json`,
  JSON.stringify(report, null, 2),
);
console.log(JSON.stringify(report, null, 2));
