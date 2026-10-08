from rest_framework import viewsets, status, permissions
from rest_framework.decorators import action
from rest_framework.response import Response
from drf_spectacular.utils import extend_schema

from apps.authentication.models import Membership
from apps.authentication.permissions import IsOrganizationMember
from apps.scans.models import Scan, ScanStatus
from .models import Project
from .serializers import ProjectSerializer


class ProjectViewSet(viewsets.ModelViewSet):
    serializer_class = ProjectSerializer
    permission_classes = [permissions.IsAuthenticated, IsOrganizationMember]

    def get_queryset(self):
        user = self.request.user
        if not user or not user.is_authenticated:
            return Project.objects.none()
        if user.is_superuser:
            return Project.objects.all()

        user_orgs = Membership.objects.filter(user=user).values_list("organization_id", flat=True)
        return Project.objects.filter(organization_id__in=user_orgs).select_related("organization")

    def perform_create(self, serializer):
        user = self.request.user
        org = serializer.validated_data.get("organization")
        if not org:
            # Fall back to first membership organization
            first_membership = Membership.objects.filter(user=user).first()
            if not first_membership:
                raise ValueError("User does not belong to any organization.")
            serializer.save(organization=first_membership.organization)
        else:
            serializer.save()

    @extend_schema(
        description="Initiate an asynchronous security scan for this project",
        responses={202: dict},
    )
    @action(detail=True, methods=["post"], url_path="scans")
    def start_scan(self, request, pk=None):
        project = self.get_object()
        source = request.data.get("source", "manual")
        ref = request.data.get("ref", project.default_branch)
        profile = request.data.get("profile", project.scan_profile)
        commit_sha = request.data.get("commit_sha", "")

        scan = Scan.objects.create(
            project=project,
            source=source,
            ref=ref,
            profile=profile,
            commit_sha=commit_sha,
            status=ScanStatus.QUEUED,
        )

        # Trigger background Celery task
        from apps.scans.tasks import run_scan
        run_scan.delay(str(scan.id))

        return Response(
            {
                "id": str(scan.id),
                "project_id": str(project.id),
                "status": scan.status,
                "profile": scan.profile,
                "ref": scan.ref,
                "message": "Security scan queued successfully.",
            },
            status=status.HTTP_202_ACCEPTED,
        )
