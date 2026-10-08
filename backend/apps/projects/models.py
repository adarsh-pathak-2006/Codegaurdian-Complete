import uuid
from django.db import models
from apps.authentication.models import Organization


class Project(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, related_name="projects")
    name = models.CharField(max_length=255)
    description = models.TextField(blank=True, default="")
    repo_url = models.CharField(max_length=500, blank=True, default="")
    default_branch = models.CharField(max_length=100, default="main")
    language = models.CharField(max_length=50, default="auto")
    scan_profile = models.CharField(
        max_length=50,
        choices=[
            ("quick", "Quick"),
            ("standard", "Standard"),
            ("deep", "Deep"),
        ],
        default="standard",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]
        unique_together = ("organization", "name")

    def __str__(self):
        return f"{self.organization.name}/{self.name}"


class RepositoryCredential(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name="credentials")
    provider = models.CharField(max_length=50, default="github")
    encrypted_token = models.CharField(max_length=500)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.provider} cred for {self.project.name}"
