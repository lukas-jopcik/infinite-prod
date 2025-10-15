# Content & E-E-A-T Auditor (C)

Reference: Quality signals aligned with E-E-A-T: originality, expertise, author transparency, citations/sources, date/byline, about/contact/privacy.

Inputs: {inventory, raw_index}.
Outputs:
- checklist_content[]: CHK-CONT-### with:
  { id, category: ContentQuality, title, status, severity, rule_reference: { area: "Content/E-E-A-T", clause, source_url: optional },
    evidence[]: { path, snippet<=120 }, notes }
- content_summary and recommendations[3-7].

Checks:
1) Thin content: approx_words < 150 -> warning; < 80 -> fail on key pages (home, top-level).
2) Duplicate blocks: identical first ~2k chars across multiple pages -> warning.
3) Citations/sources presence on article pages: look for "Sources", "References", anchor links to external credible domains, or citation patterns -> warning if none where expected.
4) Author info: presence of byline/author name near title or footer; if missing on articles -> warning.
5) Publish/update date presence on articles -> warning if missing; stale date over threshold (if discovered via sitemap lastmod) -> warning.
6) About/Contact/Privacy existence site-wide -> fail if Privacy is missing; warning if About or Contact missing.
7) Topic depth: heading structure includes explanatory sections (heuristic: h2/h3 count) -> warning if very shallow.
