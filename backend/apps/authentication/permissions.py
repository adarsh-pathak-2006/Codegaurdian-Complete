from rest_framework import permissions
from apps.authentication.models import Membership, MembershipRole


class IsOrganizationMember(permissions.BasePermission):
    """
    Enforces tenant isolation: User must belong to the organization
    associated with the requested resource.
    """

    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated)

    def has_object_permission(self, request, view, obj):
        user = request.user
        if not user or not user.is_authenticated:
            return False

        if user.is_superuser:
            return True

        # Resolve organization from object
        org = None
        if hasattr(obj, "organization"):
            org = obj.organization
        elif hasattr(obj, "project"):
            org = obj.project.organization
        elif hasattr(obj, "scan"):
            org = obj.scan.project.organization
        elif hasattr(obj, "finding"):
            org = obj.finding.scan.project.organization
        elif hasattr(obj, "owner"):
            return obj.owner == user

        if not org:
            return False

        return Membership.objects.filter(organization=org, user=user).exists()


class IsOrganizationAdmin(permissions.BasePermission):
    """Ensures user has OWNER or ADMIN role within the organization."""

    def has_object_permission(self, request, view, obj):
        user = request.user
        if not user or not user.is_authenticated:
            return False
        if user.is_superuser:
            return True

        org = getattr(obj, "organization", None)
        if not org and hasattr(obj, "project"):
            org = obj.project.organization

        if not org:
            return False

        return Membership.objects.filter(
            organization=org,
            user=user,
            role__in=[MembershipRole.OWNER, MembershipRole.ADMIN],
        ).exists()
