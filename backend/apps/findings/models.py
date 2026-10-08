import uuid
import hashlib
from django.db import models
from apps.scans.models import Scan


class FindingSeverity(models.TextChoices):
    CRITICAL = "CRITICAL", "Critical"
    HIGH = "HIGH", "High"
    MEDIUM = "MEDIUM", "Medium"
    LOW = "LOW", "Low"
    INFORMATIONAL = "INFORMATIONAL", "Informational"


class FindingStatus(models.TextChoices):
    OPEN = "OPEN", "Open"
    FALSE_POSITIVE = "FALSE_POSITIVE", "False Positive"
    ACCEPTED_RISK = "ACCEPTED_RISK", "Accepted Risk"
    FIX_IN_PROGRESS = "FIX_IN_PROGRESS", "Fix in Progress"
    FIXED = "FIXED", "Fixed"
    REOPENED = "REOPENED", "Reopened"


def generate_fingerprint(rule_id: str, file_path: str, code_identity: str) -> str:
    """
    Generate stable finding fingerprint so issues can be tracked across commits.
    Hashes normalized rule ID + relative file path + relevant code identity.
    """
    normalized_path = file_path.replace("\\", "/").strip().lower()
    raw = f"{rule_id.strip()}:{normalized_path}:{code_identity.strip()}"
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


class Finding(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    scan = models.ForeignKey(Scan, on_delete=models.CASCADE, related_name="findings")
    fingerprint = models.CharField(max_length=64, db_index=True)
    rule_id = models.CharField(max_length=255, db_index=True)
    title = models.CharField(max_length=255)
    description = models.TextField(blank=True, default="")
    severity = models.CharField(max_length=20, choices=FindingSeverity.choices, default=FindingSeverity.MEDIUM)
    confidence = models.FloatField(default=0.8)
    status = models.CharField(max_length=30, choices=FindingStatus.choices, default=FindingStatus.OPEN)
    status_reason = models.TextField(blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-severity", "-created_at"]

    def __str__(self):
        return f"[{self.severity}] {self.title} ({self.rule_id})"


class FindingLocation(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    finding = models.OneToOneField(Finding, on_delete=models.CASCADE, related_name="location")
    file_path = models.CharField(max_length=1000)
    line_start = models.IntegerField(default=1)
    line_end = models.IntegerField(default=1)
    code_context = models.TextField(blank=True, default="")

    def __str__(self):
        return f"{self.file_path}:{self.line_start}-{self.line_end}"


class FindingEvidence(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    finding = models.OneToOneField(Finding, on_delete=models.CASCADE, related_name="evidence")
    scanner = models.CharField(max_length=50)  # semgrep, gitleaks, osv
    scanner_version = models.CharField(max_length=50, blank=True, default="")
    raw_output = models.JSONField(default=dict, blank=True)
    normalized_evidence = models.TextField(blank=True, default="")

    def __str__(self):
        return f"{self.scanner} evidence for {self.finding_id}"


class Dependency(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    scan = models.ForeignKey(Scan, on_delete=models.CASCADE, related_name="dependencies")
    ecosystem = models.CharField(max_length=50)  # PyPI, npm
    name = models.CharField(max_length=255)
    version = models.CharField(max_length=100)
    manifest_path = models.CharField(max_length=1000)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["name"]

    def __str__(self):
        return f"{self.ecosystem}:{self.name}@{self.version}"


class DependencyVulnerability(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    dependency = models.ForeignKey(Dependency, on_delete=models.CASCADE, related_name="vulnerabilities")
    vulnerability_id = models.CharField(max_length=100)  # CVE-xxx or GHSA-xxx
    severity = models.CharField(max_length=20, default="MEDIUM")
    title = models.CharField(max_length=500)
    fixed_version = models.CharField(max_length=100, blank=True, default="")
    advisory_url = models.URLField(max_length=500, blank=True, default="")

    def __str__(self):
        return f"{self.vulnerability_id} ({self.dependency.name})"
