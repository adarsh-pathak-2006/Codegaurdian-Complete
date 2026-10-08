from dataclasses import dataclass, field
from pathlib import Path
from typing import Dict, List, Any, Optional, Protocol


@dataclass
class RawFinding:
    rule_id: str
    title: str
    description: str
    severity: str
    confidence: float
    file_path: str
    line_start: int
    line_end: int
    code_context: str
    evidence: str
    raw_details: Dict[str, Any] = field(default_factory=dict)


@dataclass
class RawVulnerability:
    vulnerability_id: str
    severity: str
    title: str
    fixed_version: str = ""
    advisory_url: str = ""


@dataclass
class RawDependency:
    ecosystem: str
    name: str
    version: str
    manifest_path: str
    vulnerabilities: List[RawVulnerability] = field(default_factory=list)


@dataclass
class ScannerResult:
    scanner_name: str
    scanner_version: str
    raw_output: Dict[str, Any]
    findings: List[RawFinding] = field(default_factory=list)
    dependencies: List[RawDependency] = field(default_factory=list)
    duration_ms: int = 0
    success: bool = True
    error_message: str = ""


@dataclass
class ScanConfig:
    profile: str = "standard"
    workspace_path: Path = Path(".")
    languages: List[str] = field(default_factory=lambda: ["python", "javascript"])
    excluded_paths: List[str] = field(
        default_factory=lambda: [
            ".git",
            "node_modules",
            "venv",
            ".venv",
            "__pycache__",
            ".pytest_cache",
            "dist",
            "build",
        ]
    )


class ScannerAdapter(Protocol):
    name: str

    def scan(self, workspace: Path, config: ScanConfig) -> ScannerResult:
        ...
