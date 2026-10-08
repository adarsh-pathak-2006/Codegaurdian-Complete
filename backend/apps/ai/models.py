import uuid
from django.db import models
from apps.findings.models import Finding


class AIAnalysis(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    finding = models.OneToOneField(Finding, on_delete=models.CASCADE, related_name="ai_analysis")
    model = models.CharField(max_length=100)
    prompt_version = models.CharField(max_length=50, default="v1.0")
    summary = models.TextField()
    why_it_is_a_problem = models.TextField()
    attack_scenario = models.TextField()
    recommended_fix = models.TextField()
    patch_strategy = models.TextField(blank=True, default="")
    confidence = models.FloatField(default=0.8)
    needs_human_review = models.BooleanField(default=True)
    raw_response = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"AI Analysis for Finding {self.finding_id} ({self.model})"
