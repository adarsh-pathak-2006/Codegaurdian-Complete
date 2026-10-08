import os
import tempfile
from pathlib import Path
from django.core.management.base import BaseCommand
from rest_framework.authtoken.models import Token

from apps.authentication.models import User, Organization, Membership, MembershipRole
from apps.projects.models import Project
from apps.scans.models import Scan, ScanStatus
from apps.scans.orchestrator import ScanOrchestrator


class Command(BaseCommand):
    help = "Seed demo user, organization, project with intentional vulnerabilities, and run initial scan"

    def handle(self, *args, **options):
        self.stdout.write("Seeding demo data for CodeGuardian...")

        # 1. Create or get user
        user, created = User.objects.get_or_create(
            email="admin@codeguardian.io",
            defaults={"first_name": "Demo", "last_name": "Admin", "is_staff": True, "is_superuser": True},
        )
        if created:
            user.set_password("GuardianPass123!")
            user.save()
            self.stdout.write(self.style.SUCCESS("Created admin user: admin@codeguardian.io (pass: GuardianPass123!)"))
        else:
            self.stdout.write("User admin@codeguardian.io already exists.")

        token, _ = Token.objects.get_or_create(user=user)
        self.stdout.write(f"API Token: {token.key}")

        # 2. Organization & Membership
        org, _ = Organization.objects.get_or_create(
            slug="demo-seclab",
            defaults={"name": "Demo SecLab", "owner": user},
        )
        Membership.objects.get_or_create(
            organization=org,
            user=user,
            defaults={"role": MembershipRole.OWNER},
        )

        # 3. Create demo vulnerable workspace inside artifacts or scratch
        demo_dir = Path("demo_target_repo")
        demo_dir.mkdir(exist_ok=True)

        # Write vulnerable view
        (demo_dir / "views.py").write_text(
            """import os
import pickle
import hashlib

def get_user_profile(request):
    username = request.GET.get("username", "")
    # Vulnerability 1: SQL Injection
    query = f"SELECT id, username, email FROM users WHERE username = '{username}'"
    cursor.execute(query)

def calculate_formula(request):
    raw_expr = request.POST.get("expr", "")
    # Vulnerability 2: Arbitrary code execution via eval
    return eval(raw_expr)

def store_session(token):
    # Vulnerability 3: Insecure pickle deserialization
    data = pickle.loads(token)
    # Vulnerability 4: Weak MD5 cryptographic hashing
    hashed = hashlib.md5(data).hexdigest()
    return hashed
""",
            encoding="utf-8",
        )

        # Write vulnerable config with exposed key
        (demo_dir / "settings.py").write_text(
            """DEBUG = True
SECRET_KEY = "django-insecure-dummy-key"
AWS_ACCESS_KEY_ID = "AKIAIOSFODNN7EXAMPLE"
DATABASE_URL = "postgres://dbadmin:p@ssword123@prod-db.internal:5432/app"
""",
            encoding="utf-8",
        )

        # Write requirements.txt with vulnerable dependency
        (demo_dir / "requirements.txt").write_text(
            """django==4.2.0
requests==2.28.1
urllib3==1.26.4
""",
            encoding="utf-8",
        )

        # 4. Project
        project, _ = Project.objects.get_or_create(
            organization=org,
            name="AI-Generated E-Commerce Backend",
            defaults={
                "description": "Prototype backend containing AI-generated routes and sample database logic",
                "repo_url": str(demo_dir.resolve()),
                "language": "python",
                "scan_profile": "standard",
            },
        )
        self.stdout.write(self.style.SUCCESS(f"Configured demo project: {project.name}"))

        # 5. Run initial scan
        self.stdout.write("Running initial security scan on demo repo...")
        scan = Scan.objects.create(
            project=project,
            source="manual",
            ref="main",
            status=ScanStatus.QUEUED,
        )
        orchestrator = ScanOrchestrator(scan)
        orchestrator.run()

        scan.refresh_from_db()
        self.stdout.write(
            self.style.SUCCESS(
                f"Initial scan completed! ID: {scan.id} | Risk Score: {scan.risk_score}/100\n"
                f"Findings -> Critical: {scan.critical_count}, High: {scan.high_count}, Medium: {scan.medium_count}, Low: {scan.low_count}"
            )
        )
