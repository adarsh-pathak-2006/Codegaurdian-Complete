import logging
from typing import List, Dict
from django.db import transaction

from apps.findings.models import (
    Finding,
    FindingLocation,
    FindingEvidence,
    Dependency,
    DependencyVulnerability,
    generate_fingerprint,
)
from apps.risk.engine import normalize_severity, calculate_finding_score
from apps.scans.models import Scan
from .base import ScannerResult, RawFinding, RawDependency

logger = logging.getLogger(__name__)


class FindingNormalizer:
    """
    Normalizes heterogeneous scanner results into the canonical CodeGuardian Finding schema,
    generates deterministic fingerprints for deduplication, and persists the models.
    """

    @transaction.atomic
    def process_and_persist(
        self, scan: Scan, scanner_results: List[ScannerResult]
    ) -> Dict[str, int]:
        seen_fingerprints = set()
        created_findings = 0
        created_dependencies = 0

        for result in scanner_results:
            # 1. Process Findings
            for raw in result.findings:
                # Normalize severity
                norm_severity = normalize_severity(raw.severity)
                
                # Generate stable fingerprint
                # Use rule_id + file_path + line_start or evidence hash
                code_identity = raw.code_context.strip() if raw.code_context else raw.evidence
                fingerprint = generate_fingerprint(raw.rule_id, raw.file_path, code_identity)

                if fingerprint in seen_fingerprints:
                    continue  # Deduplicate within same scan
                seen_fingerprints.add(fingerprint)

                # Persist Finding
                finding = Finding.objects.create(
                    scan=scan,
                    fingerprint=fingerprint,
                    rule_id=raw.rule_id,
                    title=raw.title,
                    description=raw.description,
                    severity=norm_severity,
                    confidence=raw.confidence,
                )

                # Persist Location
                FindingLocation.objects.create(
                    finding=finding,
                    file_path=raw.file_path,
                    line_start=raw.line_start,
                    line_end=raw.line_end,
                    code_context=raw.code_context,
                )

                # Persist Evidence
                FindingEvidence.objects.create(
                    finding=finding,
                    scanner=result.scanner_name,
                    scanner_version=result.scanner_version,
                    raw_output=raw.raw_details,
                    normalized_evidence=raw.evidence,
                )

                created_findings += 1

            # 2. Process Dependencies (from SCA)
            for raw_dep in result.dependencies:
                dep_obj = Dependency.objects.create(
                    scan=scan,
                    ecosystem=raw_dep.ecosystem,
                    name=raw_dep.name,
                    version=raw_dep.version,
                    manifest_path=raw_dep.manifest_path,
                )
                created_dependencies += 1

                for vuln in raw_dep.vulnerabilities:
                    DependencyVulnerability.objects.create(
                        dependency=dep_obj,
                        vulnerability_id=vuln.vulnerability_id,
                        severity=normalize_severity(vuln.severity),
                        title=vuln.title,
                        fixed_version=vuln.fixed_version,
                        advisory_url=vuln.advisory_url,
                    )

        # Update scan finding counts
        counts = {
            "CRITICAL": scan.findings.filter(severity="CRITICAL").count(),
            "HIGH": scan.findings.filter(severity="HIGH").count(),
            "MEDIUM": scan.findings.filter(severity="MEDIUM").count(),
            "LOW": scan.findings.filter(severity="LOW").count(),
        }

        scan.critical_count = counts["CRITICAL"]
        scan.high_count = counts["HIGH"]
        scan.medium_count = counts["MEDIUM"]
        scan.low_count = counts["LOW"]
        scan.save(update_fields=["critical_count", "high_count", "medium_count", "low_count"])

        return {
            "findings_created": created_findings,
            "dependencies_created": created_dependencies,
            "counts": counts,
        }
