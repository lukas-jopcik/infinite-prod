# Accessibility & UX Auditor (D)

Reference: Basic a11y and mobile UX heuristics.

Inputs: {inventory, raw_index}.
Outputs:
- checklist_access[]: CHK-ACC-### items.
- a11y_summary and recommendations[3-5].

Checks:
1) Viewport meta missing -> fail (mobile UX).
2) Images missing alt (high ratio) -> warning.
3) Buttons/links with empty text (heuristic: anchors with no text) -> warning.
4) Headings order anomaly (h2 without preceding h1) -> warning.
5) Form labels missing label/for (heuristic by tag presence) -> warning.
6) Color contrast heuristic: presence of inline styles with very light grays on white (heuristic) -> warning.
7) Focus indicators: if CSS resets hide outlines globally (find "outline: none") -> warning.
