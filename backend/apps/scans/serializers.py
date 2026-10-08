from rest_framework import serializers
from .models import Scan, ScanJob


class ScanJobSerializer(serializers.ModelSerializer):
    class Meta:
        model = ScanJob
        fields = ["id", "stage", "status", "retry_count", "duration_ms", "started_at", "completed_at", "error_message"]


class ScanSerializer(serializers.ModelSerializer):
    project_name = serializers.ReadOnlyField(source="project.name")
    organization_name = serializers.ReadOnlyField(source="project.organization.name")

    class Meta:
        model = Scan
        fields = [
            "id",
            "project",
            "project_name",
            "organization_name",
            "source",
            "ref",
            "commit_sha",
            "status",
            "profile",
            "risk_score",
            "critical_count",
            "high_count",
            "medium_count",
            "low_count",
            "started_at",
            "completed_at",
            "created_at",
            "error_message",
        ]
        read_only_fields = ["id", "risk_score", "critical_count", "high_count", "medium_count", "low_count", "created_at"]


class ScanDetailSerializer(ScanSerializer):
    jobs = ScanJobSerializer(many=True, read_only=True)

    class Meta(ScanSerializer.Meta):
        fields = ScanSerializer.Meta.fields + ["jobs"]
