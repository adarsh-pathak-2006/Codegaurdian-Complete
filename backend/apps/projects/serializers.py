from rest_framework import serializers
from apps.authentication.models import Organization, Membership
from .models import Project, RepositoryCredential


class ProjectSerializer(serializers.ModelSerializer):
    organization_name = serializers.ReadOnlyField(source="organization.name")
    latest_risk_score = serializers.SerializerMethodField()
    scans_count = serializers.SerializerMethodField()

    class Meta:
        model = Project
        fields = [
            "id",
            "organization",
            "organization_name",
            "name",
            "description",
            "repo_url",
            "default_branch",
            "language",
            "scan_profile",
            "latest_risk_score",
            "scans_count",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]

    def get_latest_risk_score(self, obj):
        latest = obj.scans.filter(status="COMPLETED").order_by("-completed_at").first()
        return latest.risk_score if latest else None

    def get_scans_count(self, obj):
        return obj.scans.count()

    def validate_organization(self, value):
        user = self.context["request"].user
        if not user.is_superuser:
            if not Membership.objects.filter(organization=value, user=user).exists():
                raise serializers.ValidationError("You do not have access to this organization.")
        return value
