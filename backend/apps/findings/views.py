from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response
from drf_spectacular.utils import extend_schema

from apps.ai.service import AIRemediationService
from apps.authentication.models import Membership
from apps.authentication.permissions import IsOrganizationMember
from .models import Finding
from .serializers import (
    FindingSerializer,
    FindingStatusUpdateSerializer,
    AIAnalysisSerializer,
)


class FindingViewSet(viewsets.ModelViewSet):
    permission_classes = [permissions.IsAuthenticated, IsOrganizationMember]
    http_method_names = ["get", "patch", "post", "head", "options"]

    def get_queryset(self):
        user = self.request.user
        if not user or not user.is_authenticated:
            return Finding.objects.none()
        if user.is_superuser:
            return Finding.objects.all().select_related("location", "evidence", "scan", "scan__project")

        user_orgs = Membership.objects.filter(user=user).values_list("organization_id", flat=True)
        return (
            Finding.objects.filter(scan__project__organization_id__in=user_orgs)
            .select_related("location", "evidence", "scan", "scan__project")
        )

    def get_serializer_class(self):
        if self.action in ["partial_update", "update"]:
            return FindingStatusUpdateSerializer
        return FindingSerializer

    @extend_schema(
        description="Generate contextual AI security explanation and recommended fix for this finding",
        responses={200: AIAnalysisSerializer},
    )
    @action(detail=True, methods=["post"], url_path="ai-analysis")
    def generate_ai_analysis(self, request, pk=None):
        finding = self.get_object()
        service = AIRemediationService()
        analysis = service.analyze_finding(finding)
        serializer = AIAnalysisSerializer(analysis)
        return Response(serializer.data, status=status.HTTP_200_OK)
