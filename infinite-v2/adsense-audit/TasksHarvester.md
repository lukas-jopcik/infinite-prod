# Tasks Harvester (C)

Scan @root for tasks in:
- Code: .js, .jsx, .ts, .tsx, .py, .rb, .php, .java, .go, .rs, .c, .cpp, .cs, .sh
- Content: .md, .mdx, .txt
- Config: .json, .yml, .yaml (check next-sitemap config, robots.txt, next-seo config)
- Templates/HTML: .html, .htm
- Typical content roots: /content, /posts, /blog, /docs

Patterns:
- Markdown checkboxes: `- [ ] task` and `* [x] done`
- Inline markers: TODO, FIXME, NOTE (case-insensitive)
- YAML fenced blocks in .md/.txt/.yaml with top-level `tasks:` list

Outputs:
- tasks_index[]: [{file, count, tasks: [{type: checkbox|TODO|FIXME|NOTE|yaml, line?, title, meta?}]}]
- existing_tasks_table (| File | Tasks count |)
- existing_tasks_details: bullet list "[TYPE] line N: title"
