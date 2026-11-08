import { readFile } from "node:fs/promises";
import { chromium } from "@playwright/test";

// Rasterize local, credited assets. This social preview contains no invented answers.
const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  const mark = await readFile("public/favicon.svg", "utf8");
  for (const size of [192, 512]) {
    await page.setViewportSize({ width: size, height: size });
    await page.setContent(
      `<style>html,body{margin:0;width:100%;height:100%}svg{width:100%;height:100%}</style>${mark}`,
    );
    await page.screenshot({ path: `public/icon-${size}.png`, omitBackground: true });
  }
  const font = async (file) => (await readFile(`public/fonts/${file}`)).toString("base64");
  const [pixel, sans, mono, garden] = await Promise.all([
    font("GeistPixel-Square.woff2"),
    font("Geist-Variable.woff2"),
    font("GeistMono-Regular.woff2"),
    readFile("public/art/pollinations-garden-day-2048.webp").then((bytes) =>
      bytes.toString("base64"),
    ),
  ]);
  const providers = [
    ["OpenAI", "#10a37f", "Text answer"],
    ["DeepSeek", "#4d5bff", "Text answer"],
    ["Meta", "#0866ff", "Text answer"],
    ["xAI", "#c8ccd6", "Text answer"],
    ["Z.ai", "#8b5cf6", "Text answer"],
    ["FLUX", "#f59e0b", "Visual answer"],
  ];
  await page.setViewportSize({ width: 1200, height: 630 });
  await page.setContent(`<!doctype html><html lang="en"><head><style>
    @font-face{font-family:Pixel;src:url(data:font/woff2;base64,${pixel}) format('woff2')}
    @font-face{font-family:Sans;src:url(data:font/woff2;base64,${sans}) format('woff2');font-weight:100 900}
    @font-face{font-family:Mono;src:url(data:font/woff2;base64,${mono}) format('woff2')}
    *{box-sizing:border-box}body{margin:0;background:#d8cfc0;color:#272117;font-family:Sans,sans-serif;font-synthesis:none}
    header{height:56px;margin:16px;display:flex;align-items:center;gap:10px;padding:10px 12px;border:1px solid #8c816f;background:#e9e2d4}
    header svg{width:32px;height:32px}.wordmark{font-family:Pixel,monospace;font-size:28px;word-spacing:.08em}
    .run{margin-left:auto;display:flex;align-items:center;gap:9px;background:#ffd76d;padding:8px 12px 8px 8px;font:12px Mono,monospace;border:1px solid #b59a53}
    .run i{display:grid;place-items:center;background:#2721171f;width:23px;height:23px;font-style:normal}
    main{height:526px;margin:16px;padding:24px;border:1px solid #8c816f;background:#e9e2d4}
    .workbench{display:grid;grid-template-columns:1.35fr .95fr 1.6fr;align-items:center;gap:18px;height:232px}
    h1{font:60px/.95 Pixel,monospace;letter-spacing:-.04em;word-spacing:.02em;margin:0}
    .lede{font-size:15px;line-height:1.5;color:#665b4a;margin:18px 0 0}
    .art{width:100%;height:220px;object-fit:cover;object-position:right bottom;mix-blend-mode:multiply;mask-image:linear-gradient(to right,transparent,#000 14%,#000 96%,transparent),linear-gradient(to bottom,transparent,#000 14%,#000 85%,transparent);mask-composite:intersect}
    .composer{height:220px;padding:14px;border:1px solid #8c816f;background:#dce5ef;box-shadow:4px 4px 0 #1a150f24}
    .composer-label{display:flex;align-items:center;justify-content:space-between;font:11px Mono,monospace}
    .surprise{padding:6px;border:1px solid #8c816f;background:#e9e2d4}
    .question{font-size:23px;line-height:1.4;margin:18px 0 24px;min-height:76px}
    .starters{display:flex;gap:10px;padding-top:12px;border-top:1px solid #27211733;font-size:12px}
    .starters span{color:#665b4a;font:11px Mono,monospace}.starters a{text-decoration:underline;text-underline-offset:4px;text-decoration-color:#8c816f}
    .lineup{display:flex;align-items:center;gap:14px;margin-top:16px;font-size:14px}
    .lineup span{font:11px Mono,monospace;color:#665b4a}.lineup strong{font:11px Mono,monospace;background:#ffd76d;padding:8px 10px;border:1px solid #b59a53}
    .models{display:grid;grid-template-columns:repeat(6,1fr);gap:8px;margin-top:10px}
    .model{height:112px;border:1px solid #8c816f;border-top:3px solid var(--provider);padding:13px}
    .model small{display:flex;align-items:center;gap:7px;font:11px Mono,monospace;color:#665b4a}
    .model i{width:6px;height:6px;background:var(--provider)}.model h2{font-size:19px;font-weight:550;margin:10px 0 7px}.model p{font-size:12px;color:#665b4a;margin:0}
    footer{display:flex;align-items:center;justify-content:space-between;margin-top:28px;font-size:13px;color:#665b4a}
    .signature{font:30px Pixel,monospace;word-spacing:.08em;color:#272117}
  </style></head><body>
    <header>${mark}<span class="wordmark">Model Table</span><div class="run"><i>▷</i>Run the table</div></header>
    <main>
      <div class="workbench">
        <div><h1>One Question.<br>Every Model.</h1><p class="lede">Compare answers, speed<br>and Pollen cost.</p></div>
        <img class="art" src="data:image/webp;base64,${garden}" alt="">
        <div class="composer">
          <div class="composer-label">Your question <span class="surprise">Surprise me</span></div>
          <p class="question">What do you really think of humans?</p>
          <div class="starters"><span>Try</span><a>Humans</a><a>Love</a><a>Inventions</a></div>
        </div>
      </div>
      <div class="lineup">Model lineup <span>6 selected</span><strong>Core 6</strong><span>Quest Pollen</span><span>All models</span></div>
      <div class="models">${providers
        .map(
          ([name, color, kind]) => `
        <div class="model" style="--provider:${color}"><small><i></i>Independent answer</small><h2>${name}</h2><p>${kind}</p></div>
      `,
        )
        .join("")}</div>
      <footer><span>Made with pollinations.ai · Bring Your Own Pollen.</span><span class="signature">Curiosity, Multiplied.</span></footer>
    </main>
  </body></html>`);
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: "public/og.png" });
  console.log("Generated 192/512px icons and the 1200×630 garden design preview.");
} finally {
  await browser.close();
}
