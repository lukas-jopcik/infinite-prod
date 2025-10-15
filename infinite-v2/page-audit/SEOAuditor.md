# SEO Auditor (B)

Reference: General on-page SEO practices (title/description, canonical, robots, hreflang, schema.org, internal linking).

Inputs: {inventory, raw_index, framework, mode}.
Outputs:
- checklist_seo[]: CHK-SEO-### items with:
  { id, category: SEO, title, status (pass|warning|fail), severity (low|medium|high|critical),
    rule_reference: { area: "SEO", clause: short name, source_url: optional doc link },
    evidence[]: { path, snippet<=120 },
    notes }
- seo_summary: key counts and coverage
- seo_recommendations[3-7]

Checks (per page unless marked site-wide):
1) Titles: missing, empty, or too short/long (<15 or >65 chars) -> warning.
2) Meta description: missing or too short (<50) -> warning.
3) Canonical: missing on paginated/deep pages; multiple canonicals -> fail.
4) Robots: noindex where it should index, or conflicting robots tag -> fail.
5) H1: missing or multiple H1 -> warning.
6) Headings structure: h1->h2 logical order issues -> warning (heuristic).
7) Internal linking: orphan pages (0 inbound links within crawl) -> warning (if detectable).
8) Hreflang: invalid pairs or missing x-default in multilingual sites -> warning (if hreflang present).
9) Schema.org: Article/NewsArticle/BreadcrumbList/Organization present where relevant; if absent on article pages -> warning.
10) Image alt: many images without alt -> warning (threshold-based).
11) HTTP external resources: http:// scripts or images -> fail (security/SEO mixed).

Mark evidence with real paths and short excerpts (e.g., title text, meta snippet, canonical href).
