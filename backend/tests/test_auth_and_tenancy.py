import pytest
from rest_framework.test import APIClient
from apps.authentication.models import User, Organization, Membership, MembershipRole
from apps.projects.models import Project


@pytest.mark.django_db
def test_user_registration_and_login():
    client = APIClient()
    # 1. Register
    reg_resp = client.post(
        "/api/v1/auth/register/",
        {
            "email": "alice@guardian.io",
            "password": "StrongPassword123!",
            "first_name": "Alice",
            "organization_name": "Alice Corp",
        },
        format="json",
    )
    assert reg_resp.status_code == 201
    assert "token" in reg_resp.data
    assert reg_resp.data["user"]["email"] == "alice@guardian.io"

    # 2. Login
    login_resp = client.post(
        "/api/v1/auth/login/",
        {
            "email": "alice@guardian.io",
            "password": "StrongPassword123!",
        },
        format="json",
    )
    assert login_resp.status_code == 200
    assert "token" in login_resp.data


@pytest.mark.django_db
def test_tenant_isolation_projects():
    # User A in Org A
    user_a = User.objects.create_user(email="user_a@example.com", password="Password123!")
    org_a = Organization.objects.create(name="Org A", slug="org-a", owner=user_a)
    Membership.objects.create(organization=org_a, user=user_a, role=MembershipRole.OWNER)
    proj_a = Project.objects.create(organization=org_a, name="Secret Repo A")

    # User B in Org B
    user_b = User.objects.create_user(email="user_b@example.com", password="Password123!")
    org_b = Organization.objects.create(name="Org B", slug="org-b", owner=user_b)
    Membership.objects.create(organization=org_b, user=user_b, role=MembershipRole.OWNER)
    proj_b = Project.objects.create(organization=org_b, name="Secret Repo B")

    # Client logged in as User A
    client_a = APIClient()
    client_a.force_authenticate(user=user_a)

    # User A listing projects should ONLY see Secret Repo A
    resp = client_a.get("/api/v1/projects/")
    assert resp.status_code == 200
    project_names = [p["name"] for p in resp.data["results"]]
    assert "Secret Repo A" in project_names
    assert "Secret Repo B" not in project_names

    # User A attempting to access Secret Repo B directly should get 404
    direct_resp = client_a.get(f"/api/v1/projects/{proj_b.id}/")
    assert direct_resp.status_code == 404
