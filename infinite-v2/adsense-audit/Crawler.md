# Project Crawler (A)

Goal: Build a reliable inventory for static and hybrid apps (Next.js, Nuxt, Gatsby, Astro, SvelteKit).

Inputs: either @folder OR URL.
Preferred: @folder with a static export.

Framework detection (folder mode):
- Next.js indicators: `next.config.js`, `.next/`, `app/` or `pages/`, `public/`.
  - If `out/` exists, analyze HTML there (preferred).
  - Else inspect `.next/`:
    * Read `.next/prerender-manifest.json`.
    * Read `.next/build-manifest.json` and `.next/server/pages-manifest.json` (Pages Router) or `.next/server/app/*` (App Router).
    * Include any prerendered HTML under `.next/server/app/**/index.html` or `.next/server/pages/**.html`.
  - If nothing analyzable, request URL crawl mode.
- Gatsby: use `public/`.
- Astro: use `dist/`.
- Nuxt: `.output/public/` (Nuxt3) or `dist/`.
- SvelteKit: `build/` or adapter-specific output.

URL crawling mode (SSR/ISR or no static export):
- Require base URL (e.g., http://localhost:3000).
- Seed: `/`; if `sitemap.xml` exists include entries (cap 100), else add likely routes `/`, `/about`, `/contact`, `/privacy`, `/blog` + first-level nav from `/`.
- Crawl up to 50 pages.

For each page (file or URL) extract:
- title, presence of viewport meta, `<a href>`, `<script src>`, `<img src>`, normalized text.

Outputs:
- inventory.pages[]: { pathOrUrl, approx_words, has_viewport, external_scripts[], links_out[], images[], issues: [] }
- raw_index[pathOrUrl]: { title, text_first_2k_chars, sample_links[], sample_scripts[] }
- framework: Next|Gatsby|Astro|Nuxt|SvelteKit|Unknown
- mode: static|prerender|ssr|mixed
- sources: consulted roots/manifests/URLs

If zero HTML found:
- Ask for export or URL: "Run `next build && next export` and send @out/ OR provide a local URL."
