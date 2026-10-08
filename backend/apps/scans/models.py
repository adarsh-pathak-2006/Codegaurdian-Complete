import uuid
from django.db import models
from apps.projects.models import Project


class ScanStatus(models.TextChoices):
    QUEUED = "QUEUED", "Queued"
    PREPARING = "PREPARING", "Preparing"
    SCANNING = "SCANNING", "Scanning"
    NORMALIZING = "NORMALIZING", "Normalizing"
    SCORING = "SCORING", "Scoring"
    COMPLETED = "COMPLETED", "Completed"
    FAILED = "FAILED", "Failed"
    CANCELLED = "CANCELLED", "Cancelled"


class ScanSource(models.TextChoices):
    MANUAL = "manual", "Manual"
    GITHUB_WEBHOOK = "github_webhook", "GitHub Webhook"
    UPLOAD = "upload", "Upload"


class Scan(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name="scans")
    source = models.CharField(max_length=50, choices=ScanSource.choices, default=ScanSource.MANUAL)
    ref = models.CharField(max_length=255, default="main")
    commit_sha = models.CharField(max_length=64, blank=True, default="")
    status = models.CharField(max_length=50, choices=ScanStatus.choices, default=ScanStatus.QUEUED)
    profile = models.CharField(max_length=50, default="standard")
    
    # Risk and aggregate counts
    risk_score = models.IntegerField(null=True, blank=True)
    critical_count = models.IntegerField(default=0)
    high_count = models.IntegerField(default=0)
    medium_count = models.IntegerField(default=0)
    low_count = models.IntegerField(default=0)

    # Lifecycle and logs
    error_message = models.TextField(blank=True, default="")
    started_at = models.DateTimeField(null=True, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"Scan {self.id} for {self.project.name} ({self.status})"


class ScanJob(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    scan = models.ForeignKey(Scan, on_delete=models.CASCADE, related_name="jobs")
    stage = models.CharField(max_length=50)
    celery_task_id = models.CharField(max_length=255, blank=True, default="")
    status = models.CharField(
        max_length=50,
        choices=[
            ("pending", "Pending"),
            ("running", "Running"),
            ("completed", "Completed"),
            ("failed", "Failed"),
        ],
        default="pending",
    )
    retry_count = models.IntegerField(default=0)
    duration_ms = models.IntegerField(default=0)
    error_message = models.TextField(blank=True, default="")
    started_at = models.DateTimeField(null=True, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["started_at"]

    def __str__(self):
        return f"Job {self.stage} for Scan {self.scan_id} ({self.status})"
