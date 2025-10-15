# BMAD-Style Multi-Agent Prompts Pack (AdSense + SEO + Content + UX + Performance)

This pack contains prompts for creating a multi-agent workflow in Cursor.
Each file is a system prompt for an agent role. Orchestrator coordinates all roles and
produces a single `compliance_seo_report.md` at the project root (or current workspace if URL-only).

Agents included:
- Orchestrator.md
- Crawler.md
- SEOAuditor.md
- ContentEEAT.md
- AccessibilityUX.md
- PerformanceAuditor.md
- AdSenseAuditor.md
- TasksHarvester.md
- ReportComposer.md

Usage in Cursor:
1) Create a Custom Agent "Orchestrator" with `Orchestrator.md`.
2) Create helper agents from the other files.
3) In chat, send an @folder (prefer static export) or local URL (e.g., http://localhost:3000).
4) Orchestrator coordinates A->...->H and writes `compliance_seo_report.md` with all sections.
