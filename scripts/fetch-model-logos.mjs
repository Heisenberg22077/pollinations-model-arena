import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";

// Current upstream revision verified with GitHub on 2026-11-08; no moving CDN URLs.
const repository = "lobehub/lobe-icons";
const revision = "ea434b96e75813517b377825e01c0df61dee8836";
const names = [
  "openai",
  "deepseek-color",
  "meta-color",
  "grok",
  "zai",
  "bfl",
  "nvidia-color",
  "minimax-color",
  "claude-color",
  "qwen-color",
  "gemini-color",
];
const destination = "public/logos";
await mkdir(destination, { recursive: true });

function fetchFile(path) {
  const response = JSON.parse(
    execFileSync("gh", ["api", `repos/${repository}/contents/${path}?ref=${revision}`], {
      encoding: "utf8",
    }),
  );
  const data = Buffer.from(response.content, "base64");
  const blob = createHash("sha1").update(`blob ${data.length}\0`).update(data).digest("hex");
  assert.equal(blob, response.sha);
  return { data, blob };
}

const assets = [];
for (const name of names) {
  const file = `${name}.svg`;
  const path = `packages/static-svg/icons/${file}`;
  const { data, blob } = fetchFile(path);
  const svg = data.toString("utf8");
  assert(svg.startsWith("<svg") && svg.includes("viewBox="), `Invalid logo: ${file}`);
  assert(
    !/<script|<foreignObject|\bon\w+=|(?:href|src)=["']https?:/i.test(svg),
    `Nonlocal SVG: ${file}`,
  );
  await writeFile(`${destination}/${file}`, data);
  assets.push({
    file,
    path,
    blob,
    bytes: data.length,
    source: `https://github.com/${repository}/blob/${revision}/${path}`,
  });
}
const license = fetchFile("LICENSE");
await writeFile(`${destination}/LOBE-ICONS-LICENSE.txt`, license.data);
// The official 2026 model page supplies a specific Small 4 emblem, newer than generic marks.
const mistralSource = "https://mistral.ai/cms-media/api/media/file/Icon-Model-Small.svg";
const mistralResponse = await fetch(mistralSource);
assert(mistralResponse.ok, "Official Mistral Small 4 logo download failed.");
const mistral = Buffer.from(await mistralResponse.arrayBuffer());
const mistralSha256 = createHash("sha256").update(mistral).digest("hex");
assert.equal(
  mistralSha256,
  "78b9493bad8d43470522c0e69b7d0ddbf7763f4f78fd5636f2da78e8e0ae1cf1",
  "Mistral asset changed; review the current brand page before updating its hash.",
);
await writeFile(`${destination}/mistral-small-4.svg`, mistral);
assets.push({
  file: "mistral-small-4.svg",
  source: mistralSource,
  brandGuide: "https://mistral.ai/brand/",
  bytes: mistral.length,
  sha256: mistralSha256,
  blob: createHash("sha1").update(`blob ${mistral.length}\0`).update(mistral).digest("hex"),
});
await writeFile(
  `${destination}/PROVENANCE.json`,
  `${JSON.stringify(
    { repository, revision, researchedOn: "2026-11-08", upstreamUpdatedOn: "2026-11-03", assets },
    null,
    2,
  )}\n`,
);
console.log(
  `Saved ${assets.length} model/provider SVG logos, source hashes and collection license.`,
);
