# BMAD-Style Multi-Agent Prompts for Cursor (AdSense Auditor)

This pack contains five role prompts for Cursor.
Files:
- Orchestrator.md
- Crawler.md
- Auditor.md
- TasksHarvester.md
- ReportComposer.md

How to use:
1) Create a Custom Agent "AdSense Orchestrator" and paste `Orchestrator.md`.
2) Create helper agents from the other four files.
3) In chat, send @folder (preferred: static export) or a local URL (e.g., http://localhost:3000).
4) Orchestrator coordinates A->B->C->D and writes `adsense_report.md` at the project root (or current workspace when URL-only).
