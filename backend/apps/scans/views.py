from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django.http import HttpResponse
from drf_spectacular.utils import extend_schema

from apps.authentication.models import Membership
from apps.authentication.permissions import IsOrganizationMember
from apps.findings.models import Finding
from apps.findings.serializers import FindingSerializer
from apps.reports.generator import ReportGenerator
from .models import Scan
from .serializers import ScanSerializer, ScanDetailSerializer


class ScanViewSet(viewsets.ReadOnlyModelViewSet):
    permission_classes = [permissions.IsAuthenticated, IsOrganizationMember]

    def get_queryset(self):
        user = self.request.user
        if not user or not user.is_authenticated:
            return Scan.objects.none()
        if user.is_superuser:
            return Scan.objects.all().select_related("project", "project__organization")

        user_orgs = Membership.objects.filter(user=user).values_list("organization_id", flat=True)
        return (
            Scan.objects.filter(project__organization_id__in=user_orgs)
            .select_related("project", "project__organization")
            .prefetch_related("jobs")
        )

    def get_serializer_class(self):
        if self.action == "retrieve":
            return ScanDetailSerializer
        return ScanSerializer

    @extend_schema(description="List all security findings detected in this scan")
    @action(detail=True, methods=["get"], url_path="findings")
    def findings(self, request, pk=None):
        scan = self.get_object()
        queryset = Finding.objects.filter(scan=scan).select_related("location", "evidence", "ai_analysis")

        # Filters
        severity = request.query_params.get("severity")
        if severity:
            queryset = queryset.filter(severity=severity.upper())
        status_filter = request.query_params.get("status")
        if status_filter:
            queryset = queryset.filter(status=status_filter.upper())
        rule_id = request.query_params.get("rule_id")
        if rule_id:
            queryset = queryset.filter(rule_id__icontains=rule_id)

        serializer = FindingSerializer(queryset, many=True)
        return Response(serializer.data)

    @extend_schema(description="Retrieve or generate a full JSON security audit report")
    @action(detail=True, methods=["get"], url_path="report")
    def report(self, request, pk=None):
        scan = self.get_object()
        generator = ReportGenerator()
        report_data = generator._build_report_payload(scan)
        return Response(report_data)

    @extend_schema(description="Download rendered HTML security audit report")
    @action(detail=True, methods=["get"], url_path="report-html")
    def report_html(self, request, pk=None):
        scan = self.get_object()
        generator = ReportGenerator()
        report_data = generator._build_report_payload(scan)
        html = generator._render_html(report_data)
        return HttpResponse(html, content_type="text/html")
