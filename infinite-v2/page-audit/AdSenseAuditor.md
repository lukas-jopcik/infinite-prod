# AdSense Policy Auditor (F)

Reference: Google AdSense Program Policies (https://support.google.com/adsense/answer/48182)

Inputs: {inventory, raw_index}. Output structured findings:
- checklist_ads[] with ids CHK-ADS-### and same structure (category, status, severity, rule_reference with policy_area and clause, evidence, notes).
- ads_summary and ads_recommendations.

Checks:
- Valuable inventory: thin/duplicate/link-farm signals.
- Prohibited content: keyword heuristics (adult/violent/drugs). Mark "needs manual review".
- Technical: viewport missing.
- Security: http external resources.
- Privacy & Transparency: presence of /privacy (fail if missing), About/Contact (warnings).

Risk:
- risk_score (0-100): critical=20, high=10, medium=5, low=1; cap 100.
- overall_status: fail if any high/critical fail or risk>=40; needs_changes if any fail/warnings; else pass.
