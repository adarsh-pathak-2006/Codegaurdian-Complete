import tempfile
from pathlib import Path
from apps.scanners.base import ScanConfig
from apps.scanners.sast_adapter import SASTScannerAdapter
from apps.scanners.secrets_adapter import SecretScannerAdapter, mask_secret
from apps.scanners.sca_adapter import SCAScannerAdapter


def test_sast_scanner_vulnerability_detection():
    adapter = SASTScannerAdapter()
    with tempfile.TemporaryDirectory() as tmp_dir:
        workspace = Path(tmp_dir)
        vulnerable_code = """
import os

def vulnerable_login(request):
    user_input = request.POST.get("username")
    # SQL injection vulnerability
    query = f"SELECT * FROM users WHERE username = '{user_input}'"
    cursor.execute(query)

def run_calc(data):
    # Insecure eval
    return eval(data)
"""
        (workspace / "views.py").write_text(vulnerable_code, encoding="utf-8")

        config = ScanConfig(workspace_path=workspace)
        result = adapter.scan(workspace, config)

        assert result.success is True
        assert len(result.findings) >= 2

        rule_ids = [f.rule_id for f in result.findings]
        assert any("sql-injection" in r for r in rule_ids)
        assert any("insecure-eval" in r for r in rule_ids)


def test_secret_scanner_detection_and_redaction():
    adapter = SecretScannerAdapter()
    with tempfile.TemporaryDirectory() as tmp_dir:
        workspace = Path(tmp_dir)
        code_with_secrets = """
AWS_KEY = "AKIAIOSFODNN7EXAMPLE"
GITHUB_TOKEN = "ghp_1234567890abcdefghijklmnopqrstuvwxyz"
"""
        (workspace / "config.py").write_text(code_with_secrets, encoding="utf-8")

        config = ScanConfig(workspace_path=workspace)
        result = adapter.scan(workspace, config)

        assert result.success is True
        assert len(result.findings) >= 1

        # Check that secret is masked
        for f in result.findings:
            assert "AKIAIOSFODNN7EXAMPLE" not in f.description
            assert "AKIA" in f.description or "ghp_" in f.description


def test_sca_scanner_parsing():
    adapter = SCAScannerAdapter()
    with tempfile.TemporaryDirectory() as tmp_dir:
        workspace = Path(tmp_dir)
        reqs = """
django==4.2.0
requests==2.28.1
"""
        (workspace / "requirements.txt").write_text(reqs, encoding="utf-8")

        config = ScanConfig(workspace_path=workspace)
        result = adapter.scan(workspace, config)

        assert result.success is True
        dep_names = [d.name for d in result.dependencies]
        assert "django" in dep_names
        assert "requests" in dep_names
