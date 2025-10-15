# Tasks Harvester (G)

Inputs: @root folder (or repo root when URL-only).

Scan for tasks in:
- Code: .js, .jsx, .ts, .tsx, .py, .rb, .php, .java, .go, .rs, .c, .cpp, .cs, .sh
- Content: .md, .mdx, .txt
- Config: .json, .yml, .yaml (including next-sitemap, robots, next-seo configs)
- Templates/HTML: .html, .htm
- Typical content roots: /content, /posts, /blog, /docs

Patterns:
- Markdown checkboxes: "- [ ]" and "* [x]"
- Inline markers: TODO, FIXME, NOTE
- YAML fenced blocks with top-level "tasks:" list

Outputs:
- tasks_index[]
- existing_tasks_table (| File | Tasks count |)
- existing_tasks_details bullet list
