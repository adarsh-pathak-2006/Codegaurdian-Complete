import json
import logging
import re
import time
from pathlib import Path
from typing import Dict, List, Optional, Tuple
import requests

from .base import (
    ScannerAdapter,
    ScannerResult,
    RawFinding,
    RawDependency,
    RawVulnerability,
    ScanConfig,
)

logger = logging.getLogger(__name__)

OSV_API_URL = "https://api.osv.dev/v1/query"


class SCAScannerAdapter:
    """
    Software Composition Analysis (SCA) Scanner Adapter.
    Scans dependency manifests (Python requirements.txt / pyproject.toml, Node package.json)
    and queries the Open Source Vulnerabilities (OSV) database for known CVEs/advisories.
    """
    name = "sca"
    version = "1.0.0"

    def scan(self, workspace: Path, config: ScanConfig) -> ScannerResult:
        start_time = time.time()
        dependencies: List[RawDependency] = []
        findings: List[RawFinding] = []

        # 1. Parse Python dependencies
        py_deps = self._scan_python_manifests(workspace, config)
        dependencies.extend(py_deps)

        # 2. Parse Node dependencies
        node_deps = self._scan_node_manifests(workspace, config)
        dependencies.extend(node_deps)

        # 3. Query OSV for vulnerabilities
        for dep in dependencies:
            vulns = self._check_osv_vulnerabilities(dep.ecosystem, dep.name, dep.version)
            dep.vulnerabilities = vulns

            # Create findings for vulnerable dependencies
            for vuln in vulns:
                findings.append(
                    RawFinding(
                        rule_id=f"sca.{dep.ecosystem.lower()}.{vuln.vulnerability_id.lower()}",
                        title=f"Vulnerable Dependency: {dep.name} ({vuln.vulnerability_id})",
                        description=f"Package '{dep.name}' version {dep.version} is vulnerable to {vuln.title}.",
                        severity=vuln.severity,
                        confidence=0.95,
                        file_path=dep.manifest_path,
                        line_start=1,
                        line_end=1,
                        code_context=f"{dep.name}=={dep.version}",
                        evidence=(
                            f"Advisory {vuln.vulnerability_id}: {vuln.title}. "
                            f"Fixed in: {vuln.fixed_version or 'N/A'}. "
                            f"Reference: {vuln.advisory_url}"
                        ),
                        raw_details={
                            "ecosystem": dep.ecosystem,
                            "package": dep.name,
                            "version": dep.version,
                            "advisory": vuln.vulnerability_id,
                            "fixed_version": vuln.fixed_version,
                        },
                    )
                )

        duration_ms = int((time.time() - start_time) * 1000)
        return ScannerResult(
            scanner_name="sca",
            scanner_version=self.version,
            raw_output={"dependencies_scanned": len(dependencies), "vulnerabilities_found": len(findings)},
            findings=findings,
            dependencies=dependencies,
            duration_ms=duration_ms,
            success=True,
        )

    def _scan_python_manifests(self, workspace: Path, config: ScanConfig) -> List[RawDependency]:
        deps: List[RawDependency] = []

        for req_file in workspace.rglob("*requirements*.txt"):
            if any(exc in str(req_file) for exc in config.excluded_paths):
                continue
            rel_path = str(req_file.relative_to(workspace)).replace("\\", "/")
            try:
                content = req_file.read_text(encoding="utf-8", errors="ignore")
                for line in content.splitlines():
                    line = line.strip()
                    if not line or line.startswith("#") or line.startswith("-"):
                        continue
                    # Match pkg==1.2.3 or pkg>=1.2.3
                    m = re.match(r"^([a-zA-Z0-9_\-\.]+)(?:==|>=|<=|~=)([0-9a-zA-Z_\-\.]+)", line)
                    if m:
                        pkg_name = m.group(1).lower()
                        version = m.group(2)
                        deps.append(
                            RawDependency(
                                ecosystem="PyPI",
                                name=pkg_name,
                                version=version,
                                manifest_path=rel_path,
                            )
                        )
            except Exception as e:
                logger.warning(f"Error reading {req_file}: {e}")

        return deps

    def _scan_node_manifests(self, workspace: Path, config: ScanConfig) -> List[RawDependency]:
        deps: List[RawDependency] = []

        for pkg_file in workspace.rglob("package.json"):
            if any(exc in str(pkg_file) for exc in config.excluded_paths):
                continue
            rel_path = str(pkg_file.relative_to(workspace)).replace("\\", "/")
            try:
                data = json.loads(pkg_file.read_text(encoding="utf-8", errors="ignore"))
                combined = {}
                combined.update(data.get("dependencies", {}))
                combined.update(data.get("devDependencies", {}))
                for name, ver in combined.items():
                    clean_ver = re.sub(r"[\^~>=<]", "", str(ver)).strip()
                    if clean_ver and clean_ver[0].isdigit():
                        deps.append(
                            RawDependency(
                                ecosystem="npm",
                                name=name,
                                version=clean_ver,
                                manifest_path=rel_path,
                            )
                        )
            except Exception as e:
                logger.warning(f"Error reading {pkg_file}: {e}")

        return deps

    def _check_osv_vulnerabilities(self, ecosystem: str, package_name: str, version: str) -> List[RawVulnerability]:
        """Queries OSV API for known vulnerabilities for a given package and version."""
        results: List[RawVulnerability] = []
        payload = {
            "version": version,
            "package": {
                "name": package_name,
                "ecosystem": ecosystem,
            },
        }
        try:
            resp = requests.post(OSV_API_URL, json=payload, timeout=5)
            if resp.status_code == 200:
                data = resp.json()
                for vuln in data.get("vulns", []):
                    vuln_id = vuln.get("id", "UNKNOWN")
                    summary = vuln.get("summary") or vuln.get("details", "Vulnerability detected")
                    # Extract fixed version if available
                    fixed_version = ""
                    for affected in vuln.get("affected", []):
                        for r in affected.get("ranges", []):
                            for event in r.get("events", []):
                                if "fixed" in event:
                                    fixed_version = event["fixed"]
                                    break
                    
                    # Extract advisory URL
                    advisory_url = ""
                    references = vuln.get("references", [])
                    if references and isinstance(references, list):
                        advisory_url = references[0].get("url", "")

                    # Compute severity
                    sev_str = "HIGH"
                    database_specific = vuln.get("database_specific", {})
                    if "severity" in database_specific:
                        raw_sev = str(database_specific["severity"]).upper()
                        if "CRIT" in raw_sev:
                            sev_str = "CRITICAL"
                        elif "HIGH" in raw_sev:
                            sev_str = "HIGH"
                        elif "MOD" in raw_sev or "MED" in raw_sev:
                            sev_str = "MEDIUM"
                        else:
                            sev_str = "LOW"

                    results.append(
                        RawVulnerability(
                            vulnerability_id=vuln_id,
                            severity=sev_str,
                            title=summary[:200],
                            fixed_version=fixed_version,
                            advisory_url=advisory_url,
                        )
                    )
        except Exception as e:
            logger.debug(f"OSV lookup timed out or failed for {package_name}@{version}: {e}")

        return results
