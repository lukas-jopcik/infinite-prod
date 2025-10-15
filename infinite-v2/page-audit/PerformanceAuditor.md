# Performance Auditor (E)

Reference: Heuristic static checks (no network).

Inputs: {inventory, raw_index}.
Outputs:
- checklist_perf[]: CHK-PERF-### items.
- perf_summary and recommendations[3-5].

Checks:
1) Blocking scripts: many synchronous <script> without async/defer -> warning.
2) CSS bloat: very large inline <style> blocks or many external CSS files -> warning.
3) Image formats: many large JPG/PNG where WEBP/SVG would be better -> warning (heuristic via extensions).
4) Preload/preconnect usage: suggest for critical domains if many third-party resources -> warning.
5) Unused JS hint: lots of vendor scripts that do not appear needed on simple pages -> warning.
