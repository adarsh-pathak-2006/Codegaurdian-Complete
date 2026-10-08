import pytest
import tempfile
from pathlib import Path
from apps.authentication.models import User, Organization, Membership, MembershipRole
from apps.projects.models import Project
from apps.scans.models import Scan, ScanStatus
from apps.scans.orchestrator import ScanOrchestrator


@pytest.mark.django_db
def test_full_scan_orchestration_loop():
    # Setup organization and project
    user = User.objects.create_user(email="dev@codeguardian.io", password="TestPassword123!")
    org = Organization.objects.create(name="DevOrg", slug="dev-org", owner=user)
    Membership.objects.create(organization=org, user=user, role=MembershipRole.OWNER)

    with tempfile.TemporaryDirectory() as tmp_dir:
        workspace = Path(tmp_dir)
        (workspace / "app.py").write_text(
            """
import os

def query(req):
    sql = f"SELECT * FROM items WHERE id = {req.get('id')}"
    db.execute(sql)
""",
            encoding="utf-8",
        )

        project = Project.objects.create(
            organization=org,
            name="Demo Insecure App",
            repo_url=str(workspace),
        )

        scan = Scan.objects.create(
            project=project,
            status=ScanStatus.QUEUED,
        )

        orchestrator = ScanOrchestrator(scan)
        orchestrator.run()

        scan.refresh_from_db()
        assert scan.status == ScanStatus.COMPLETED
        assert scan.findings.count() >= 1
        assert scan.risk_score is not None
        assert scan.risk_score < 100  # Deduction applied due to SQL injection finding

        finding = scan.findings.first()
        assert finding.rule_id == "python.security.sql-injection"
        assert finding.severity == "CRITICAL"
        assert hasattr(finding, "location")
        assert "app.py" in finding.location.file_path
        assert hasattr(finding, "evidence")
