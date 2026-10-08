import sys
import time
import requests

BASE_URL = "http://127.0.0.1:8000"

def log_step(name, passed, detail=""):
    mark = "PASS" if passed else "FAIL"
    print(f"[{mark}] {name} {detail}")
    if not passed:
        sys.exit(1)

def run_verification():
    print("=" * 60)
    print("Starting Comprehensive CodeGuardian API Live Verification")
    print("=" * 60)

    session = requests.Session()

    # 1. Check Swagger UI
    try:
        r = session.get(f"{BASE_URL}/api/docs/", timeout=5)
        log_step("Swagger UI /api/docs/", r.status_code == 200, f"(Status: {r.status_code})")
    except Exception as e:
        log_step("Swagger UI /api/docs/", False, f"Connection failed: {e}")

    # 2. Check OpenAPI Schema
    r = session.get(f"{BASE_URL}/api/schema/")
    log_step("OpenAPI Schema /api/schema/", r.status_code == 200, f"(Length: {len(r.text)} bytes)")

    # 3. Test Authentication Login
    login_payload = {
        "email": "admin@codeguardian.io",
        "password": "GuardianPass123!",
    }
    r = session.post(f"{BASE_URL}/api/v1/auth/login/", json=login_payload)
    log_step("Auth Login /api/v1/auth/login/", r.status_code == 200, f"(Status: {r.status_code})")
    auth_data = r.json()
    token = auth_data.get("token")
    assert token, "Token missing in login response"
    print(f"       -> Authenticated as {auth_data['user']['email']}, Token: {token[:10]}...")

    headers = {"Authorization": f"Token {token}"}

    # 4. Test Auth Me
    r = session.get(f"{BASE_URL}/api/v1/auth/me/", headers=headers)
    log_step("Auth Me /api/v1/auth/me/", r.status_code == 200, f"(Orgs count: {len(r.json().get('organizations', []))})")
    user_me = r.json()
    org_id = user_me["organizations"][0]["id"]

    # 5. List Projects
    r = session.get(f"{BASE_URL}/api/v1/projects/", headers=headers)
    log_step("List Projects /api/v1/projects/", r.status_code == 200, f"(Total projects: {r.json().get('count')})")
    projects = r.json().get("results", [])
    demo_project = projects[0] if projects else None
    assert demo_project, "Expected at least 1 seeded demo project"
    project_id = demo_project["id"]
    print(f"       -> Working with project: '{demo_project['name']}' (ID: {project_id})")

    # 6. Create a New Project via API
    new_proj_payload = {
        "organization": org_id,
        "name": "Live API Test Project",
        "description": "Created dynamically during live verification",
        "repo_url": demo_project["repo_url"],
        "language": "python",
        "scan_profile": "standard",
    }
    r = session.post(f"{BASE_URL}/api/v1/projects/", json=new_proj_payload, headers=headers)
    log_step("Create Project /api/v1/projects/", r.status_code == 201, f"(Created ID: {r.json().get('id')})")
    live_project_id = r.json()["id"]

    # 7. Start a Scan on the Project via API
    scan_payload = {
        "source": "manual",
        "profile": "standard",
        "ref": "main",
    }
    r = session.post(f"{BASE_URL}/api/v1/projects/{live_project_id}/scans/", json=scan_payload, headers=headers)
    log_step("Start Scan /api/v1/projects/{id}/scans/", r.status_code == 202, f"(Scan status: {r.json().get('status')})")
    scan_id = r.json()["id"]
    print(f"       -> Dispatched scan ID: {scan_id}")

    # 8. Get Scan Status & Details
    r = session.get(f"{BASE_URL}/api/v1/scans/{scan_id}/", headers=headers)
    scan_detail = r.json()
    log_step("Get Scan Details /api/v1/scans/{id}/", r.status_code == 200, f"(Status: {scan_detail.get('status')}, Risk Score: {scan_detail.get('risk_score')})")
    print(f"       -> Severity Counts: Critical: {scan_detail['critical_count']}, High: {scan_detail['high_count']}, Medium: {scan_detail['medium_count']}, Low: {scan_detail['low_count']}")

    # 9. List Scan Findings
    r = session.get(f"{BASE_URL}/api/v1/scans/{scan_id}/findings/", headers=headers)
    findings = r.json()
    log_step("List Findings /api/v1/scans/{id}/findings/", r.status_code == 200, f"(Total findings: {len(findings)})")
    assert len(findings) > 0, "Expected findings from demo scan"

    # Filter findings by CRITICAL
    r_crit = session.get(f"{BASE_URL}/api/v1/scans/{scan_id}/findings/?severity=CRITICAL", headers=headers)
    log_step("Filter Findings ?severity=CRITICAL", r_crit.status_code == 200, f"(Critical count: {len(r_crit.json())})")

    first_finding = findings[0]
    finding_id = first_finding["id"]
    print(f"       -> Inspecting Finding: '{first_finding['title']}' [{first_finding['severity']}] (ID: {finding_id})")

    # 10. Get Single Finding Detail
    r = session.get(f"{BASE_URL}/api/v1/findings/{finding_id}/", headers=headers)
    finding_obj = r.json()
    has_loc = bool(finding_obj.get("location"))
    has_evi = bool(finding_obj.get("evidence"))
    log_step("Get Finding Detail /api/v1/findings/{id}/", r.status_code == 200 and has_loc and has_evi, f"(Has location: {has_loc}, Has evidence: {has_evi})")

    # 11. Update Finding Status (PATCH)
    patch_payload = {
        "status": "ACCEPTED_RISK",
        "status_reason": "Risk accepted for demonstration purposes",
    }
    r = session.patch(f"{BASE_URL}/api/v1/findings/{finding_id}/", json=patch_payload, headers=headers)
    log_step("Update Finding Status (PATCH)", r.status_code == 200 and r.json().get("status") == "ACCEPTED_RISK", f"(Updated status: {r.json().get('status')})")

    # 12. Generate AI Explanation and Remediation
    r = session.post(f"{BASE_URL}/api/v1/findings/{finding_id}/ai-analysis/", headers=headers)
    ai_data = r.json()
    has_summary = bool(ai_data.get("summary"))
    has_fix = bool(ai_data.get("recommended_fix"))
    log_step("Generate AI Remediation /api/v1/findings/{id}/ai-analysis/", r.status_code == 200 and has_summary and has_fix, f"(Model: {ai_data.get('model')})")
    print(f"       -> AI Summary: {ai_data.get('summary')}")
    print(f"       -> AI Fix: {ai_data.get('recommended_fix')[:120]}...")

    # 13. Download JSON Report
    r = session.get(f"{BASE_URL}/api/v1/scans/{scan_id}/report/", headers=headers)
    report_json = r.json()
    log_step("Download JSON Report /api/v1/scans/{id}/report/", r.status_code == 200 and "metrics" in report_json, f"(Total reported findings: {len(report_json.get('findings', []))})")

    # 14. Download HTML Report
    r = session.get(f"{BASE_URL}/api/v1/scans/{scan_id}/report-html/", headers=headers)
    is_html = "<!DOCTYPE html>" in r.text
    log_step("Download HTML Report /api/v1/scans/{id}/report-html/", r.status_code == 200 and is_html, f"(HTML size: {len(r.text)} bytes)")

    # 15. Test GitHub Webhook Endpoint
    webhook_payload = {
        "ref": "refs/heads/main",
        "after": "c0ffee1234567890",
        "repository": {
            "name": "Live API Test Project",
            "clone_url": demo_project["repo_url"],
        },
    }
    r = session.post(f"{BASE_URL}/api/v1/webhooks/github/", json=webhook_payload, headers={"X-GitHub-Event": "push"})
    log_step("GitHub Webhook /api/v1/webhooks/github/", r.status_code in [200, 202], f"(Webhook status: {r.status_code})")

    # 16. Security & Unauthorized Access Check
    r_unauth = session.get(f"{BASE_URL}/api/v1/projects/", headers={"Authorization": "Token invalid-token"})
    log_step("Tenant Security (Invalid Token rejected)", r_unauth.status_code == 401, f"(Status: {r_unauth.status_code})")

    print("=" * 60)
    print("ALL 16 LIVE API VERIFICATION CHECKS PASSED SUCCESSFULLY!")
    print("=" * 60)

if __name__ == "__main__":
    run_verification()
