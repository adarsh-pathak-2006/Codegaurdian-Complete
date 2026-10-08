"""
CodeGuardian URL Configuration
"""

from django.contrib import admin
from django.urls import path, include
from drf_spectacular.views import (
    SpectacularAPIView,
    SpectacularRedocView,
    SpectacularSwaggerView,
)
from apps.scans.webhooks import GitHubWebhookView

api_v1_patterns = [
    path("auth/", include("apps.authentication.urls")),
    path("projects/", include("apps.projects.urls")),
    path("scans/", include("apps.scans.urls")),
    path("findings/", include("apps.findings.urls")),
    path("webhooks/github/", GitHubWebhookView.as_view(), name="github-webhook"),
]

urlpatterns = [
    path("admin/", admin.site.urls),
    # Versioned API
    path("api/v1/", include(api_v1_patterns)),
    # OpenAPI 3 Documentation
    path("api/schema/", SpectacularAPIView.as_view(), name="schema"),
    path("api/docs/", SpectacularSwaggerView.as_view(url_name="schema"), name="swagger-ui"),
    path("api/redoc/", SpectacularRedocView.as_view(url_name="schema"), name="redoc"),
]
