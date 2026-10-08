import uuid
from django.db import models
from apps.scans.models import Scan


class Report(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    scan = models.ForeignKey(Scan, on_delete=models.CASCADE, related_name="reports")
    format = models.CharField(
        max_length=20,
        choices=[
            ("json", "JSON"),
            ("html", "HTML"),
            ("pdf", "PDF"),
        ],
        default="json",
    )
    artifact_location = models.CharField(max_length=1000, blank=True, default="")
    data = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.format.upper()} Report for Scan {self.scan_id}"
