from typing import Dict, Any
from apps.scans.models import Scan
from .models import Report


class ReportGenerator:
    """Generates structured JSON and HTML security audit reports."""

    def generate_json_report(self, scan: Scan) -> Report:
        data = self._build_report_payload(scan)
        report = Report.objects.create(
            scan=scan,
            format="json",
            data=data,
        )
        return report

    def generate_html_report(self, scan: Scan) -> Report:
        data = self._build_report_payload(scan)
        html_content = self._render_html(data)
        report = Report.objects.create(
            scan=scan,
            format="html",
            data=data,
            artifact_location="",  # or path to written file
        )
        return report

    def _build_report_payload(self, scan: Scan) -> Dict[str, Any]:
        findings_data = []
        for f in scan.findings.all():
            loc = getattr(f, "location", None)
            evi = getattr(f, "evidence", None)
            ai = getattr(f, "ai_analysis", None)

            findings_data.append({
                "id": str(f.id),
                "fingerprint": f.fingerprint,
                "rule_id": f.rule_id,
                "title": f.title,
                "severity": f.severity,
                "confidence": f.confidence,
                "status": f.status,
                "file_path": loc.file_path if loc else "",
                "line_start": loc.line_start if loc else 1,
                "line_end": loc.line_end if loc else 1,
                "code_context": loc.code_context if loc else "",
                "scanner": evi.scanner if evi else "",
                "evidence": evi.normalized_evidence if evi else "",
                "ai_summary": ai.summary if ai else None,
                "ai_fix": ai.recommended_fix if ai else None,
            })

        dependencies_data = []
        for dep in scan.dependencies.all():
            vulns = [
                {
                    "vulnerability_id": v.vulnerability_id,
                    "severity": v.severity,
                    "title": v.title,
                    "fixed_version": v.fixed_version,
                }
                for v in dep.vulnerabilities.all()
            ]
            dependencies_data.append({
                "ecosystem": dep.ecosystem,
                "name": dep.name,
                "version": dep.version,
                "manifest_path": dep.manifest_path,
                "vulnerabilities": vulns,
            })

        return {
            "meta": {
                "generator": "CodeGuardian Security Engine v1.0",
                "generated_at": scan.completed_at.isoformat() if scan.completed_at else None,
            },
            "project": {
                "id": str(scan.project.id),
                "name": scan.project.name,
                "organization": scan.project.organization.name,
                "repo_url": scan.project.repo_url,
                "default_branch": scan.project.default_branch,
            },
            "scan": {
                "id": str(scan.id),
                "status": scan.status,
                "profile": scan.profile,
                "risk_score": scan.risk_score,
                "started_at": scan.started_at.isoformat() if scan.started_at else None,
                "completed_at": scan.completed_at.isoformat() if scan.completed_at else None,
            },
            "metrics": {
                "critical": scan.critical_count,
                "high": scan.high_count,
                "medium": scan.medium_count,
                "low": scan.low_count,
                "total_findings": len(findings_data),
                "total_dependencies": len(dependencies_data),
            },
            "findings": findings_data,
            "dependencies": dependencies_data,
        }

    def _render_html(self, data: Dict[str, Any]) -> str:
        # Simple HTML report render
        proj = data["project"]
        scan = data["scan"]
        m = data["metrics"]
        return f"""<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>CodeGuardian Security Report - {proj['name']}</title>
  <style>
    body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0f172a; color: #f8fafc; padding: 2rem; }}
    .card {{ background: #1e293b; border-radius: 8px; padding: 1.5rem; margin-bottom: 1.5rem; border: 1px solid #334155; }}
    .badge {{ display: inline-block; padding: 0.25rem 0.5rem; border-radius: 4px; font-weight: bold; font-size: 0.85rem; }}
    .badge-crit {{ background: #ef4444; color: white; }}
    .badge-high {{ background: #f97316; color: white; }}
    .badge-med {{ background: #eab308; color: black; }}
    .badge-low {{ background: #3b82f6; color: white; }}
    .score {{ font-size: 3rem; font-weight: bold; color: {'#22c55e' if (scan['risk_score'] or 0) > 70 else '#ef4444'}; }}
    pre {{ background: #020617; padding: 1rem; border-radius: 6px; overflow-x: auto; color: #94a3b8; }}
  </style>
</head>
<body>
  <h1>CodeGuardian Security Report</h1>
  <div class="card">
    <h2>Project: {proj['name']} ({proj['organization']})</h2>
    <p>Repository: {proj['repo_url']} | Scan ID: {scan['id']}</p>
    <div class="score">{scan['risk_score'] or 0} / 100</div>
    <p>Critical: {m['critical']} | High: {m['high']} | Medium: {m['medium']} | Low: {m['low']}</p>
  </div>
</body>
</html>"""
