from rest_framework import serializers
from apps.ai.models import AIAnalysis
from .models import (
    Finding,
    FindingLocation,
    FindingEvidence,
    FindingStatus,
    Dependency,
    DependencyVulnerability,
)


class FindingLocationSerializer(serializers.ModelSerializer):
    class Meta:
        model = FindingLocation
        fields = ["file_path", "line_start", "line_end", "code_context"]


class FindingEvidenceSerializer(serializers.ModelSerializer):
    class Meta:
        model = FindingEvidence
        fields = ["scanner", "scanner_version", "raw_output", "normalized_evidence"]


class AIAnalysisSerializer(serializers.ModelSerializer):
    class Meta:
        model = AIAnalysis
        fields = [
            "id",
            "model",
            "prompt_version",
            "summary",
            "why_it_is_a_problem",
            "attack_scenario",
            "recommended_fix",
            "patch_strategy",
            "confidence",
            "needs_human_review",
            "created_at",
        ]


class FindingSerializer(serializers.ModelSerializer):
    location = FindingLocationSerializer(read_only=True)
    evidence = FindingEvidenceSerializer(read_only=True)
    ai_analysis = AIAnalysisSerializer(read_only=True)
    project_id = serializers.ReadOnlyField(source="scan.project_id")
    project_name = serializers.ReadOnlyField(source="scan.project.name")

    class Meta:
        model = Finding
        fields = [
            "id",
            "scan",
            "project_id",
            "project_name",
            "fingerprint",
            "rule_id",
            "title",
            "description",
            "severity",
            "confidence",
            "status",
            "status_reason",
            "location",
            "evidence",
            "ai_analysis",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "scan", "fingerprint", "rule_id", "severity", "confidence", "created_at"]


class FindingStatusUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Finding
        fields = ["status", "status_reason"]

    def validate_status(self, value):
        if value not in FindingStatus.values:
            raise serializers.ValidationError(f"Invalid status. Must be one of {FindingStatus.values}")
        return value
