# Model logo sources and rendering

Live research on 2026-11-08 used Firecrawl's brand-asset lookup, official brand pages and GitHub CLI 2.102.0. The current [LobeHub catalog](https://lobehub.com/icons) offers static SVGs and color/monochrome variants. GitHub verified its latest source revision as `ea434b96e75813517b377825e01c0df61dee8836`, updated on 2026-11-03. This is a source snapshot, not a claim that every mark was redesigned in 2026.

Eleven unmodified SVGs come from that pinned [Lobe Icons revision](https://github.com/lobehub/lobe-icons/tree/ea434b96e75813517b377825e01c0df61dee8836). Its MIT notice is retained in [public/logos/LOBE-ICONS-LICENSE.txt](../public/logos/LOBE-ICONS-LICENSE.txt).

The twelfth mark comes directly from [Mistral's current official brand page](https://mistral.ai/brand/), which publishes a 2026 collection and a specific [Mistral Small 4 SVG](https://mistral.ai/cms-media/api/media/file/Icon-Model-Small.svg). Its downloaded bytes are pinned by SHA-256. The official model emblem is used instead of an older generic Mistral mark. Brand ownership remains with Mistral; the collection MIT license is not applied to this asset.

| Models                    | Displayed mark                |
| ------------------------- | ----------------------------- |
| GPT-5.4 Nano, GPT-OSS 20B | OpenAI Blossom                |
| DeepSeek V4.1 Flash       | DeepSeek                      |
| Llama 3.3 70B             | Meta                          |
| Grok 4.3                  | Grok                          |
| GLM 5.3 Flash             | Z.ai                          |
| FLUX.1 Schnell            | Black Forest Labs             |
| Nemotron 3.5 Lightning    | NVIDIA                        |
| MiniMax M3.1 Flash        | MiniMax                       |
| Claude Haiku 4.5          | Claude                        |
| Qwen 3.8 Flash            | Qwen                          |
| Gemini 3.8 Flash          | Gemini                        |
| Mistral Small 4           | Official Small 4 model emblem |

[OpenAI's current guidelines](https://openai.com/brand/) informed intact proportions and black/white rendering. These marks identify the services being compared, rather than serving as Model Table's primary branding. Mistral's original colors and model drawing are retained. No logo is redrawn or stretched.

[ModelLogo](../src/components/ModelLogo.tsx) is shared by selection controls, waiting cards and completed cards. Controls reserve 18px; card headers reserve 22px. Color SVGs use normal local images with fixed dimensions and `object-fit: contain`. The official Mistral illustration occupies 104 of its 160 pixels; a static 1.5× proportional size compensates for that transparent margin while keeping the visible drawing inside the same icon box. Monochrome SVGs render intact through CSS alpha masks, in black for day and white for night. Mobile toggles have 224px width to accommodate the marks; the touch target remains at least 44px. Degraded health retains a small amber indicator.

No icon package, SVG-to-React plugin, tracking CDN, runtime download API or raster favicon service is added. Static vector assets use the configured Vite base path and keep their original bytes. Browser caching and fixed boxes avoid layout shifts. Adjacent model/provider names remain the accessible labels; decorative logo images have empty alt text.

Biome preserves original vendor SVG formatting and exempts only `public/logos/*.svg` from the inline SVG title rule. These external decorative assets are hidden from assistive technology by the shared component; application accessibility rules remain enabled.

Reproduce with `npm run assets:logos`. [public/logos/PROVENANCE.json](../public/logos/PROVENANCE.json) records original URLs, paths, hashes and byte counts. `npm run verify:artifact` checks the copied assets after root and Pages builds.
