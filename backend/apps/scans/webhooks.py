import hashlib
import hmac
import json
import logging
import os
from rest_framework import views, status, permissions
from rest_framework.response import Response
from drf_spectacular.utils import extend_schema

from apps.projects.models import Project
from .models import Scan, ScanStatus
from .tasks import run_scan

logger = logging.getLogger(__name__)


class GitHubWebhookView(views.APIView):
    permission_classes = [permissions.AllowAny]

    @extend_schema(description="Receive GitHub push and pull_request webhook events")
    def post(self, request):
        secret = os.environ.get("GITHUB_WEBHOOK_SECRET")
        if secret:
            signature = request.headers.get("X-Hub-Signature-256", "")
            if not signature.startswith("sha256="):
                return Response({"error": "Invalid signature format"}, status=status.HTTP_401_UNAUTHORIZED)

            digest = hmac.new(secret.encode(), request.body, hashlib.sha256).hexdigest()
            expected = f"sha256={digest}"
            if not hmac.compare_digest(signature, expected):
                return Response({"error": "Signature mismatch"}, status=status.HTTP_401_UNAUTHORIZED)

        event = request.headers.get("X-GitHub-Event", "push")
        payload = request.data

        repo_info = payload.get("repository", {})
        clone_url = repo_info.get("clone_url") or repo_info.get("html_url", "")
        repo_name = repo_info.get("name", "")

        # Find project matching repo_url or repo_name
        project = None
        if clone_url:
            project = Project.objects.filter(repo_url__icontains=clone_url).first()
        if not project and repo_name:
            project = Project.objects.filter(repo_url__icontains=repo_name).first()

        if not project:
            return Response(
                {"status": "ignored", "reason": "No matching CodeGuardian project found for repository"},
                status=status.HTTP_200_OK,
            )

        ref = "main"
        commit_sha = ""
        if event == "push":
            ref = payload.get("ref", "refs/heads/main").replace("refs/heads/", "")
            commit_sha = payload.get("after", "")
        elif event == "pull_request":
            pr = payload.get("pull_request", {})
            ref = pr.get("head", {}).get("ref", "main")
            commit_sha = pr.get("head", {}).get("sha", "")

        scan = Scan.objects.create(
            project=project,
            source="github_webhook",
            ref=ref,
            commit_sha=commit_sha,
            status=ScanStatus.QUEUED,
        )

        run_scan.delay(str(scan.id))

        return Response(
            {"scan_id": str(scan.id), "status": "QUEUED", "project": project.name},
            status=status.HTTP_202_ACCEPTED,
        )
