from rest_framework import serializers
from django.contrib.auth import authenticate
from django.utils.text import slugify
from .models import User, Organization, Membership, MembershipRole


class OrganizationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Organization
        fields = ["id", "name", "slug", "created_at"]
        read_only_fields = ["id", "slug", "created_at"]


class UserSerializer(serializers.ModelSerializer):
    organizations = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ["id", "email", "first_name", "last_name", "created_at", "organizations"]
        read_only_fields = ["id", "created_at", "organizations"]

    def get_organizations(self, obj):
        memberships = Membership.objects.filter(user=obj).select_related("organization")
        return [
            {
                "id": str(m.organization.id),
                "name": m.organization.name,
                "role": m.role,
            }
            for m in memberships
        ]


class RegisterSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True, min_length=8)
    first_name = serializers.CharField(required=False, default="")
    last_name = serializers.CharField(required=False, default="")
    organization_name = serializers.CharField(required=False, default="Personal")

    def validate_email(self, value):
        if User.objects.filter(email__iexact=value).exists():
            raise serializers.ValidationError("A user with this email already exists.")
        return value.lower()

    def create(self, validated_data):
        user = User.objects.create_user(
            email=validated_data["email"],
            password=validated_data["password"],
            first_name=validated_data.get("first_name", ""),
            last_name=validated_data.get("last_name", ""),
        )
        # Create default organization for new user
        org_name = validated_data.get("organization_name") or f"{user.email.split('@')[0]}'s Org"
        base_slug = slugify(org_name)
        slug = base_slug
        counter = 1
        while Organization.objects.filter(slug=slug).exists():
            slug = f"{base_slug}-{counter}"
            counter += 1

        org = Organization.objects.create(
            name=org_name,
            slug=slug,
            owner=user,
        )
        Membership.objects.create(
            organization=org,
            user=user,
            role=MembershipRole.OWNER,
        )
        return user


class LoginSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True)

    def validate(self, data):
        email = data.get("email", "").lower()
        password = data.get("password", "")
        user = authenticate(username=email, password=password)
        if not user:
            raise serializers.ValidationError("Invalid email or password.")
        if not user.is_active:
            raise serializers.ValidationError("Account is disabled.")
        data["user"] = user
        return data
