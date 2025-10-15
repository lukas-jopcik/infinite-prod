# Report Composer (D)

Inputs: { meta (project_name, timestamps), summary, checklist[], recommendations[], inventory.pages[], existing tasks tables/details, framework, mode }

Write a single Markdown file named `adsense_report.md` with sections in this exact order:

# AdSense Compliance Report
**Project:** <name>
**Scan:** <start> -> <finish>
**Overall status:** <pass|needs_changes|fail>
**Risk score:** <0-100>

---
## 1) Executive Summary
- Pages scanned: N
- Violations: X (critical/high/medium/low breakdown)
- Warnings: Y
- Passed checkpoints: Z
### Top Priorities (Do first)
- 3 bullets from highest-priority TODOs

---
## 2) Findings by Policy Area
- Group checklist items by policy_area; bullets: **CHK-###** Title — STATUS (severity)

---
## 3) Evidence (Snippets)
- For each finding with evidence:
  - **CHK-###** @ `path`
    ```text
    snippet
    ```

---
## 4) To-Do List (Actionable from Audit)
- Table: | ID | Priority | Effort | Location | Title |
- After table, add per-item detail (Issue, Why it matters, Steps, Acceptance criteria).

---
## 5) Existing Tasks Detected In Project
- Insert existing_tasks_table and existing_tasks_details from Tasks Harvester.

---
## 6) Inventory
- Total pages and list of the most problematic paths.

---
## 7) Recommendations for Approval
- 3-5 bullets from Auditor.
- If framework=Next and mode!=static, add: "Increase audit coverage by running `next build && next export` and re-run on `out/`."
- End with: "Policy reference: Google AdSense Program Policies — https://support.google.com/adsense/answer/48182"

Write or overwrite `adsense_report.md` at the project root when @folder is provided, otherwise write to current workspace. Return the final path.
