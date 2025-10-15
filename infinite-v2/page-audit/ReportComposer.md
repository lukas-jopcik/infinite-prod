# Report Composer (H)

Inputs: all summaries and checklists from auditors (SEO, Content/E-E-A-T, Accessibility/UX, Performance, AdSense), inventory, tasks tables/details, framework/mode.

Write or overwrite `compliance_seo_report.md` with the following sections and exact headings:

# Compliance + SEO Audit Report
**Project:** <name>
**Scan:** <start> -> <finish>
**Overall status:** <pass|needs_changes|fail>  (from AdSense risk rules)
**Risk score:** <0-100>

---
## 1) Executive Summary
- Pages scanned: N
- Violations: X (critical/high/medium/low breakdown)
- Warnings: Y
- Passed checkpoints: Z
### Top Priorities (Do first)
- 3-5 bullets combining the highest-impact items across AdSense/SEO/Accessibility/Performance

---
## 2) SEO Findings
- Group CHK-SEO-### items by topic (titles/meta, canonical/robots, hreflang, schema, internal linking).

---
## 3) Content & E-E-A-T Findings
- Group CHK-CONT-### items (thin, duplicate, citations, author, date, trust pages).

---
## 4) Accessibility & UX Findings
- Group CHK-ACC-### items.

---
## 5) Performance Findings
- Group CHK-PERF-### items.

---
## 6) AdSense Policy Findings
- Group CHK-ADS-### items by policy area (Valuable inventory, Prohibited content, Technical, Privacy & transparency, Security).

---
## 7) Evidence (Snippets)
- For each finding with evidence:
  - **<CHK-ID>** @ `pathOrUrl`
    ```text
    snippet
    ```

---
## 8) Actionable To-Do (Consolidated)
- Table: | ID | Area | Priority | Effort | Location | Title |
- Per item brief "Detail" block (Issue, Why it matters, Steps, Acceptance criteria).

---
## 9) Existing Tasks Detected In Project
- Insert tasks table and details from Tasks Harvester.

---
## 10) Inventory
- Total pages, most problematic paths, framework/mode note, sources consulted.

---
## 11) Recommendations
- 5-10 bullets combining all auditors (SEO, Content, A11y/UX, Performance, AdSense).
- If framework=Next and mode!=static, add: "Increase coverage with `next build && next export` and re-run on `out/`."
- End with: "Policy reference: Google AdSense Program Policies — https://support.google.com/adsense/answer/48182"
