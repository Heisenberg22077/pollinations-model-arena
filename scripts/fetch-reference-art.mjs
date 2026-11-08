import { execFile } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { promisify } from "node:util";

// Read-only extraction from the MIT-licensed reference, pinned for reproducibility.
const run = promisify(execFile);
const revision = "62d7cc4df19aef8a68363046330ab584fc2f6921";
const files = [
  ["home-hero-day-1024.webp", "pollinations-garden-day.webp"],
  ["home-hero-night-1024.webp", "pollinations-garden-night.webp"],
  ["home-hero-day.webp", "pollinations-garden-day-2048.webp"],
  ["home-hero-night.webp", "pollinations-garden-night-2048.webp"],
  ["home-closing-day.webp", "pollinations-closing-day.webp"],
  ["home-closing-night.webp", "pollinations-closing-night.webp"],
  ["home-closing-day-1024.webp", "pollinations-closing-day-1024.webp"],
  ["home-closing-night-1024.webp", "pollinations-closing-night-1024.webp"],
];
const provenance = [];

await mkdir("public/art", { recursive: true });
for (let index = 0; index < files.length; index += 2) {
  const results = await Promise.all(
    files.slice(index, index + 2).map(async ([source, target]) => {
      const { stdout } = await run(
        "gh",
        [
          "api",
          `repos/pollinations/pollinations/contents/pollinations.ai/public/art/${source}?ref=${revision}`,
        ],
        { maxBuffer: 2_000_000 },
      );
      const asset = JSON.parse(stdout);
      if (asset.encoding !== "base64" || !asset.content) throw new Error(`Missing ${source}`);
      const bytes = Buffer.from(asset.content.replace(/\s/g, ""), "base64");
      await writeFile(`public/art/${target}`, bytes);
      console.log(`${target}: ${bytes.length} bytes, upstream blob ${asset.sha}`);
      return {
        file: target,
        source: `pollinations.ai/public/art/${source}`,
        bytes: bytes.length,
        blob: asset.sha,
      };
    }),
  );
  provenance.push(...results);
}
await writeFile(
  "public/art/PROVENANCE.json",
  `${JSON.stringify({ repository: "pollinations/pollinations", revision, license: "MIT", assets: provenance }, null, 2)}\n`,
);
