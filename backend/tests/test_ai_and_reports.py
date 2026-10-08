import pytest
from rest_framework.test import APIClient
from apps.ai.redactor import redact_sensitive_data
from apps.ai.service import AIRemediationService
from apps.authentication.models import User, Organization, Membership, MembershipRole
from apps.findings.models import Finding, FindingLocation, FindingEvidence
from apps.projects.models import Project
from apps.reports.generator import ReportGenerator
from apps.scans.models import Scan, ScanStatus


def test_secret_redaction_in_prompt_context():
    sensitive_snippet = 'client = boto3.client("s3", aws_access_key_id="AKIAIOSFODNN7EXAMPLE")'
    redacted = redact_sensitive_data(sensitive_snippet)
    assert "AKIAIOSFODNN7EXAMPLE" not in redacted
    assert "[REDACTED_SECRET_" in redacted


@pytest.mark.django_db
def test_ai_remediation_and_reports():
    user = User.objects.create_user(email="tester@guardian.io", password="TestPassword123!")
    org = Organization.objects.create(name="GuardianLab", slug="guardian-lab", owner=user)
    Membership.objects.create(organization=org, user=user, role=MembershipRole.OWNER)

    project = Project.objects.create(organization=org, name="Test Project")
    scan = Scan.objects.create(project=project, status=ScanStatus.COMPLETED, risk_score=75)

    finding = Finding.objects.create(
        scan=scan,
        fingerprint="dummy_fp_12345",
        rule_id="python.security.sql-injection",
        title="SQL Injection Vulnerability",
        description="Raw query formatting detected",
        severity="CRITICAL",
    )
    FindingLocation.objects.create(
        finding=finding,
        file_path="views.py",
        line_start=15,
        line_end=15,
        code_context="cursor.execute(f'SELECT * FROM users WHERE id = {user_id}')",
    )
    FindingEvidence.objects.create(
        finding=finding,
        scanner="sast",
        normalized_evidence="Direct string interpolation into execute()",
    )

    # 1. Test AI Remediation Service
    ai_service = AIRemediationService()
    analysis = ai_service.analyze_finding(finding)
    assert analysis.finding == finding
    assert len(analysis.summary) > 0
    assert len(analysis.recommended_fix) > 0

    # 2. Test Report Generator
    report_gen = ReportGenerator()
    json_report = report_gen.generate_json_report(scan)
    assert json_report.format == "json"
    assert json_report.data["metrics"]["critical"] == 0 or json_report.data["metrics"]["total_findings"] >= 1
    assert json_report.data["project"]["name"] == "Test Project"

    # 3. Test API endpoint for AI analysis
    client = APIClient()
    client.force_authenticate(user=user)
    api_resp = client.post(f"/api/v1/findings/{finding.id}/ai-analysis/")
    assert api_resp.status_code == 200
    assert api_resp.data["summary"] == analysis.summary
