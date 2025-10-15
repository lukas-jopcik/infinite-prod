# Project Crawler (A)

Goal: Build an inventory for static and hybrid apps (Next.js, Nuxt, Gatsby, Astro, SvelteKit), extracting raw signals for SEO/Content/UX/Performance/AdSense checks.

Inputs: @folder or URL. Prefer a static export folder.

Folder mode detection:
- Next.js: detect `next.config.js`, `.next/`, `app/` or `pages/`, `public/`.
  * Use `out/` if present (preferred). Else inspect `.next/`:
    - Read `.next/prerender-manifest.json` to enumerate prerendered routes.
    - Read `.next/build-manifest.json`, `.next/server/pages-manifest.json` (Pages Router) or `.next/server/app/*` (App Router) for SSR/ISR routes and any generated HTML.
    - Include any HTML found under `.next/server/app/**/index.html` or `.next/server/pages/**.html`.
  * If nothing analyzable, switch to URL crawl mode.
- Gatsby: `public/`; Astro: `dist/`; Nuxt: `.output/public/` or `dist/`; SvelteKit: `build/` (adapter-static) or adapter output.

URL crawl mode:
- Require base URL (e.g., http://localhost:3000).
- Crawl bounded set (default 50 pages). Seed:
  1) `/`
  2) sitemap.xml entries (cap 100)
  3) fallback common routes: `/about`, `/contact`, `/privacy`, `/blog`
  4) first-level nav links from `/`

For each HTML page (file or URL), extract signals into raw_index[pathOrUrl]:
- meta: title, meta description, robots meta (index/follow), viewport presence
- canonical link href, hreflang links (rel=alternate hreflang)
- headings (h1..h6) text list
- anchors: list of hrefs (internal/external classification)
- scripts: src list, inline count, async/defer usage
- images: src list; note formats (jpg/png/webp/svg), presence of alt attributes if available
- JSON-LD blocks (schema.org) as raw strings (do not expand large payloads; store first 200 chars)
- structured data presence flags: Article/NewsArticle/BreadcrumbList/WebSite/Organization
- word count (rough; from visible text)
- lastmod if discovered via sitemap (store mapping url->lastmod)
- robots.txt allow/disallow patterns if available
- http vs https external resources
- evidence snippets: short excerpts (<=120 chars) for key fields

Inventory.pages[] summary:
- { pathOrUrl, approx_words, has_viewport, meta_title_len, meta_desc_len, has_canonical, canonical_url, has_h1, headings_count, external_scripts_count, http_resources_count, images_count, issues: [] }

Also return framework, mode (static|prerender|ssr|mixed), and sources consulted (e.g., out/, .next/manifests, sitemap, robots).

If zero HTML, report reason and ask for export or URL.
