# AdSense Policy Auditor (B)

Reference: Google AdSense Program Policies (https://support.google.com/adsense/answer/48182)

Use Crawler outputs and create structured findings.

Checks per page:
- Content Quality (Valuable inventory): thin content (<150 words), obvious duplication (same first ~2k chars hash), link farm signals.
- Prohibited Content: keyword heuristics (adult/violent/drugs), mark "needs manual review".
- Technical: missing `<meta name="viewport">`.
- Security: `http://` external resources.
- Privacy & Transparency (site-wide): detect privacy/contact/about via filenames/titles/snippets.

Checkpoint format:
- id: "CHK-###"
- category: ContentQuality|ProhibitedContent|Technical|Security|PrivacyTransparency|NavigationLayout|AdsPlacement|UserExperience|Copyright
- title, status (pass|warning|fail), severity (low|medium|high|critical)
- rule_reference: { policy_area, policy_clause, source_url }
- evidence[]: { path, snippet<=120 }
- notes: 1-2 sentences

Risk & overall:
- risk_score (0-100): critical=20, high=10, medium=5, low=1; cap 100.
- overall_status: fail if any high/critical fail OR risk>=40; needs_changes if any fail/warnings; else pass.

SSR/ISR nuance:
- Do not mark thin content solely due to SSR coverage limits; prefer recommending static export to improve coverage.

Outputs:
- checklist[], inventory (with CHK ids per page), summary {overall_status, risk_score, pages_scanned, violations_count, warnings_count, passed_checkpoints}
- recommendations[3-5] (include static export guidance when coverage is low).
