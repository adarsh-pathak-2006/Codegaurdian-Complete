import json
import logging
import math
import re
import shutil
import subprocess
import time
from pathlib import Path
from typing import List, Tuple

from .base import ScannerAdapter, ScannerResult, RawFinding, ScanConfig

logger = logging.getLogger(__name__)


def calculate_shannon_entropy(data: str) -> float:
    """Calculates the Shannon entropy of a string."""
    if not data:
        return 0.0
    entropy = 0.0
    length = len(data)
    frequencies = {c: data.count(c) for c in set(data)}
    for count in frequencies.values():
        p = count / length
        entropy -= p * math.log2(p)
    return entropy


def mask_secret(secret: str) -> str:
    """Masks secret to prevent plaintext leakage in logs and database."""
    if len(secret) <= 8:
        return "*" * len(secret)
    return secret[:4] + "*" * (len(secret) - 8) + secret[-4:]


class SecretScannerAdapter:
    """
    Secret Scanner Adapter.
    Executes Gitleaks when available, and provides high-precision pattern
    and entropy-based scanning to detect leaked keys and credentials.
    """
    name = "secrets"
    version = "1.0.0"

    PATTERNS = [
        (
            "secrets.aws.access-key-id",
            "Exposed AWS Access Key ID",
            r"(?:A3T[A-Z0-9]|AKIA|AGPA|AIDA|AROA|AIPA|ANPA|ANVA|ASIA)[A-Z0-9]{16}",
            "CRITICAL",
        ),
        (
            "secrets.github.pat",
            "Exposed GitHub Personal Access Token",
            r"gh[pousr]_[A-Za-z0-9_]{36,255}",
            "CRITICAL",
        ),
        (
            "secrets.generic.private-key",
            "Exposed Private Encryption Key",
            r"-----BEGIN (?:RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----",
            "CRITICAL",
        ),
        (
            "secrets.slack.webhook",
            "Exposed Slack Incoming Webhook URL",
            r"https://hooks\.slack\.com/services/T[a-zA-Z0-9_]+/B[a-zA-Z0-9_]+/[a-zA-Z0-9_]+",
            "HIGH",
        ),
        (
            "secrets.generic.api-key",
            "Exposed High-Entropy Generic Secret / API Key",
            r'(?:api[_-]?key|secret[_-]?key|auth[_-]?token|password)\s*[:=]\s*["\']([a-zA-Z0-9_\-]{20,80})["\']',
            "HIGH",
        ),
        (
            "secrets.database.connection-string",
            "Hardcoded Database Connection String with Credentials",
            r'(?:postgres|postgresql|mysql|mongodb(?:\+srv)?):\/\/[^:\/\s]+:[^@\/\s]+@[^:\/\s]+',
            "CRITICAL",
        ),
    ]

    def scan(self, workspace: Path, config: ScanConfig) -> ScannerResult:
        start_time = time.time()
        findings: List[RawFinding] = []
        raw_output = {}

        gitleaks_path = shutil.which("gitleaks")
        if gitleaks_path:
            try:
                findings, raw_output = self._run_gitleaks(gitleaks_path, workspace, config)
            except Exception as e:
                logger.warning(f"Gitleaks execution failed: {e}. Falling back to internal secret scanner.")
                findings = self._run_internal_secrets(workspace, config)
                raw_output = {"engine": "internal_secrets", "findings_count": len(findings)}
        else:
            findings = self._run_internal_secrets(workspace, config)
            raw_output = {"engine": "internal_secrets", "findings_count": len(findings)}

        duration_ms = int((time.time() - start_time) * 1000)
        return ScannerResult(
            scanner_name="secrets",
            scanner_version=self.version,
            raw_output=raw_output,
            findings=findings,
            duration_ms=duration_ms,
            success=True,
        )

    def _run_gitleaks(self, gitleaks_bin: str, workspace: Path, config: ScanConfig) -> Tuple[List[RawFinding], dict]:
        report_file = workspace / ".gitleaks-temp-report.json"
        cmd = [
            gitleaks_bin,
            "dir",
            str(workspace),
            "--report-format", "json",
            "--report-path", str(report_file),
            "--no-git",
        ]
        subprocess.run(cmd, capture_output=True, text=True, timeout=120)
        findings = []
        raw = {}

        if report_file.exists():
            try:
                raw_data = json.loads(report_file.read_text(encoding="utf-8"))
                raw = {"items": len(raw_data)}
                for item in raw_data:
                    file_str = item.get("File", "")
                    try:
                        rel_path = str(Path(file_str).relative_to(workspace))
                    except ValueError:
                        rel_path = file_str
                    
                    secret_val = item.get("Secret", "")
                    masked = mask_secret(secret_val)
                    line_start = item.get("StartLine", 1)
                    line_end = item.get("EndLine", line_start)
                    rule_id = f"secrets.{item.get('RuleID', 'generic')}"

                    findings.append(
                        RawFinding(
                            rule_id=rule_id,
                            title=item.get("Description", "Detected Secret"),
                            description=f"Secret match detected: {masked}",
                            severity="CRITICAL",
                            confidence=0.98,
                            file_path=rel_path,
                            line_start=line_start,
                            line_end=line_end,
                            code_context=f"Line {line_start}: Match masked -> {masked}",
                            evidence=f"Scanner detected secret of rule {rule_id}",
                            raw_details={"rule": rule_id, "masked": masked},
                        )
                    )
            finally:
                if report_file.exists():
                    report_file.unlink()

        return findings, raw

    def _run_internal_secrets(self, workspace: Path, config: ScanConfig) -> List[RawFinding]:
        findings: List[RawFinding] = []

        for file_path in workspace.rglob("*"):
            if not file_path.is_file():
                continue

            rel_str = str(file_path.relative_to(workspace)).replace("\\", "/")
            if any(exc in rel_str for exc in config.excluded_paths):
                continue

            # Don't scan non-text/binary files
            if file_path.suffix.lower() in {".png", ".jpg", ".jpeg", ".ico", ".pdf", ".zip", ".tar", ".gz", ".pyc"}:
                continue

            try:
                content = file_path.read_text(encoding="utf-8", errors="ignore")
                lines = content.splitlines()
            except Exception:
                continue

            for idx, line in enumerate(lines, start=1):
                # Test against patterns
                for rule_id, title, pattern, severity in self.PATTERNS:
                    match = re.search(pattern, line)
                    if match:
                        matched_text = match.group(0)
                        # Filter out common placeholders or test dummy strings
                        if any(dummy in matched_text.lower() for dummy in ["your_key_here", "example", "dummy", "fake", "placeholder"]):
                            continue

                        # Check entropy for generic secret pattern
                        if "generic.api-key" in rule_id:
                            token_group = match.group(1) if match.groups() else matched_text
                            if calculate_shannon_entropy(token_group) < 3.2:
                                continue  # Low entropy, likely not a real key

                        masked = mask_secret(matched_text)
                        snippet = self._get_masked_snippet(lines, idx, matched_text, masked)

                        findings.append(
                            RawFinding(
                                rule_id=rule_id,
                                title=title,
                                description=f"Potential credential exposure detected: {masked}. Storing secrets directly in code risks unauthorized access.",
                                severity=severity,
                                confidence=0.92,
                                file_path=rel_str,
                                line_start=idx,
                                line_end=idx,
                                code_context=snippet,
                                evidence=f"Matched pattern '{rule_id}' with value {masked}",
                                raw_details={"masked_secret": masked},
                            )
                        )
                        break  # Only one finding per line to avoid noise

        return findings

    def _get_masked_snippet(self, lines: List[str], target_line: int, raw_secret: str, masked_secret: str) -> str:
        start = max(0, target_line - 2)
        end = min(len(lines), target_line + 1)
        snippet_lines = []
        for i in range(start, end):
            line_text = lines[i]
            if i == (target_line - 1):
                line_text = line_text.replace(raw_secret, masked_secret)
                snippet_lines.append(f" > {i + 1:4d} | {line_text}")
            else:
                snippet_lines.append(f"   {i + 1:4d} | {line_text}")
        return "\n".join(snippet_lines)
