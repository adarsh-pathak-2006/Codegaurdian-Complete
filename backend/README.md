# CodeGuardian Backend

Security orchestration and remediation platform for AI-generated code.

## Architecture

- **Platform Framework**: Django 5 + Django REST Framework (DRF)
- **Database**: SQLite (local development) / PostgreSQL (production via `DATABASE_URL`)
- **Queue / Asynchronous Workers**: Celery + Redis (with eager mode fallback for local dev)
- **API Versioning**: `/api/v1/`
- **Documentation**: OpenAPI 3 + Swagger UI at `/api/docs/`

## Key Capabilities Implemented

1. **Authentication & Multi-Tenant Isolation** (`apps/authentication`):
   - Custom `User` model with email login and UUID primary keys.
   - `Organization` and `Membership` models (Roles: Owner, Admin, Developer, Viewer).
   - Strict tenant-scoped querysets preventing cross-organization data leakage.

2. **Project Management** (`apps/projects`):
   - Project registration, scan profiles (`quick`, `standard`, `deep`).
   - Repository credential references.

3. **Multi-Engine Security Scanning** (`apps/scanners`):
   - **SAST**: Semgrep CLI runner with internal AST & pattern analysis fallback (SQL injection, dynamic eval/exec, shell=True command injection, pickle deserialization, weak hashing).
   - **Secrets**: Gitleaks runner with high-entropy & pattern scanner (AWS keys, GitHub tokens, database connection strings, private keys) with automatic value masking.
   - **SCA**: Dependency manifest scanner (`requirements.txt`, `package.json`) querying the Open Source Vulnerabilities (OSV) API.

4. **Normalized Finding & Risk Scoring Engine** (`apps/findings`, `apps/risk`):
   - Tool-agnostic canonical `Finding`, `FindingLocation`, `FindingEvidence`, `Dependency` models.
   - Deterministic SHA-256 fingerprinting for tracking issues across commits.
   - Spec-compliant risk score calculation:
     $$\text{Score} = \text{clamp}(100 - (\text{Critical} \times 20 + \text{High} \times 10 + \text{Medium} \times 3 + \text{Low} \times 1), 0, 100)$$

5. **AI Remediation Service** (`apps/ai`):
   - Provider abstraction supporting local Ollama, OpenAI-compatible APIs, and mock engine.
   - Bounded context builder with secret redaction before prompting.
   - Prompt-injection defense: source code marked strictly as untrusted data.
   - Strict JSON structured output: `summary`, `why_it_is_a_problem`, `attack_scenario`, `recommended_fix`, `patch_strategy`, `confidence`, `needs_human_review`.

6. **Reporting** (`apps/reports`):
   - JSON report snapshot generation and download.
   - Rendered HTML executive report.

## Quick Start

### 1. Activate Virtual Environment
```powershell
.\.venv\Scripts\Activate.ps1
```

### 2. Apply Migrations
```bash
cd backend
python manage.py migrate
```

### 3. Seed Demo Data & Trigger Scan
```bash
python manage.py seed_demo
```
This generates:
- Admin user: `admin@codeguardian.io` / `GuardianPass123!`
- Demo organization and project with intentional AI-generated vulnerabilities
- Runs a complete end-to-end security scan and stores findings and risk scores.

### 4. Run Development Server
```bash
python manage.py runserver
```
- API Root: `http://localhost:8000/api/v1/`
- Swagger UI: `http://localhost:8000/api/docs/`
- Admin: `http://localhost:8000/admin/`

### 5. Run Test Suite
```bash
pytest
```
