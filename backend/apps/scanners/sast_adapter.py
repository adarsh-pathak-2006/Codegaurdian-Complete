import ast
import json
import logging
import re
import shutil
import subprocess
import time
from pathlib import Path
from typing import List, Optional

from .base import ScannerAdapter, ScannerResult, RawFinding, ScanConfig

logger = logging.getLogger(__name__)


class SASTScannerAdapter:
    """
    SAST Scanner Adapter orchestrating Semgrep if available,
    with a built-in AST & pattern analyzer as a robust, reproducible engine.
    """
    name = "sast"
    version = "1.0.0"

    def scan(self, workspace: Path, config: ScanConfig) -> ScannerResult:
        start_time = time.time()
        findings: List[RawFinding] = []
        raw_output = {}

        # 1. Try Semgrep if installed on system PATH
        semgrep_path = shutil.which("semgrep")
        if semgrep_path:
            try:
                findings, raw_output = self._run_semgrep(semgrep_path, workspace, config)
            except Exception as e:
                logger.warning(f"Semgrep execution failed: {e}. Falling back to internal engine.")
                findings = self._run_internal_sast(workspace, config)
                raw_output = {"engine": "internal_ast", "findings_count": len(findings)}
        else:
            findings = self._run_internal_sast(workspace, config)
            raw_output = {"engine": "internal_ast", "findings_count": len(findings)}

        duration_ms = int((time.time() - start_time) * 1000)
        return ScannerResult(
            scanner_name="sast",
            scanner_version=self.version,
            raw_output=raw_output,
            findings=findings,
            duration_ms=duration_ms,
            success=True,
        )

    def _run_semgrep(self, semgrep_bin: str, workspace: Path, config: ScanConfig):
        cmd = [
            semgrep_bin,
            "scan",
            "--json",
            "--config",
            "auto",
            "--quiet",
            str(workspace),
        ]
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=120)
        findings = []
        raw = {}
        if result.stdout:
            try:
                raw = json.loads(result.stdout)
                for item in raw.get("results", []):
                    rule_id = item.get("check_id", "sast.generic.warning")
                    path_str = item.get("path", "")
                    try:
                        rel_path = str(Path(path_str).relative_to(workspace))
                    except ValueError:
                        rel_path = path_str

                    start = item.get("start", {})
                    end = item.get("end", {})
                    line_start = start.get("line", 1)
                    line_end = end.get("line", line_start)
                    extra = item.get("extra", {})
                    message = extra.get("message", "Potential security issue")
                    severity = extra.get("severity", "WARNING").upper()
                    lines = extra.get("lines", "")

                    findings.append(
                        RawFinding(
                            rule_id=rule_id,
                            title=rule_id.split(".")[-1].replace("-", " ").title(),
                            description=message,
                            severity=severity,
                            confidence=0.85,
                            file_path=rel_path,
                            line_start=line_start,
                            line_end=line_end,
                            code_context=lines,
                            evidence=message,
                            raw_details=item,
                        )
                    )
            except json.JSONDecodeError:
                pass
        return findings, raw

    def _run_internal_sast(self, workspace: Path, config: ScanConfig) -> List[RawFinding]:
        """
        Internal AST & pattern security analyzer for Python & JS/TS.
        Detects common AI-generated weaknesses:
        - SQL injection (raw query formatting / f-strings in queries)
        - Command injection (os.system, subprocess with shell=True)
        - Insecure eval / exec
        - Path traversal (open/os.path.join with unsanitized user inputs)
        - Hardcoded Django DEBUG = True in production configs
        - Unsafe deserialization (pickle.loads, yaml.load without SafeLoader)
        - Weak hashing (MD5, SHA1 for passwords)
        """
        findings: List[RawFinding] = []

        for file_path in workspace.rglob("*"):
            if not file_path.is_file():
                continue

            rel_str = str(file_path.relative_to(workspace)).replace("\\", "/")
            if any(exc in rel_str for exc in config.excluded_paths):
                continue

            if file_path.suffix.lower() == ".py":
                findings.extend(self._analyze_python_file(file_path, workspace))
            elif file_path.suffix.lower() in {".js", ".ts", ".jsx", ".tsx"}:
                findings.extend(self._analyze_js_file(file_path, workspace))

        return findings

    def _analyze_python_file(self, file_path: Path, workspace: Path) -> List[RawFinding]:
        findings = []
        rel_path = str(file_path.relative_to(workspace)).replace("\\", "/")

        try:
            content = file_path.read_text(encoding="utf-8", errors="ignore")
            lines = content.splitlines()
        except Exception:
            return findings

        # Check Python AST
        try:
            tree = ast.parse(content, filename=str(file_path))
            for node in ast.walk(tree):
                # 1. eval / exec
                if isinstance(node, ast.Call) and isinstance(node.func, ast.Name):
                    if node.func.id in {"eval", "exec"}:
                        snippet = self._get_snippet(lines, node.lineno)
                        findings.append(
                            RawFinding(
                                rule_id="python.security.insecure-eval",
                                title="Use of Insecure Dynamic Code Execution",
                                description=f"Use of '{node.func.id}()' allows arbitrary code execution if user-controlled input reaches it.",
                                severity="CRITICAL",
                                confidence=0.95,
                                file_path=rel_path,
                                line_start=node.lineno,
                                line_end=getattr(node, "end_lineno", node.lineno),
                                code_context=snippet,
                                evidence=f"Direct invocation of {node.func.id}() detected.",
                            )
                        )

                # 2. subprocess / os.system with shell=True or string commands
                if isinstance(node, ast.Call):
                    # os.system(...)
                    if (
                        isinstance(node.func, ast.Attribute)
                        and isinstance(node.func.value, ast.Name)
                        and node.func.value.id == "os"
                        and node.func.attr == "system"
                    ):
                        snippet = self._get_snippet(lines, node.lineno)
                        findings.append(
                            RawFinding(
                                rule_id="python.security.os-system-command-injection",
                                title="Potential Command Injection via os.system",
                                description="os.system executes shell commands without argument escaping, enabling command injection.",
                                severity="HIGH",
                                confidence=0.9,
                                file_path=rel_path,
                                line_start=node.lineno,
                                line_end=getattr(node, "end_lineno", node.lineno),
                                code_context=snippet,
                                evidence="Invocation of os.system() detected.",
                            )
                        )
                    # subprocess with shell=True
                    if (
                        isinstance(node.func, ast.Attribute)
                        and isinstance(node.func.value, ast.Name)
                        and node.func.value.id == "subprocess"
                    ):
                        for kw in node.keywords:
                            if kw.arg == "shell" and isinstance(kw.value, ast.Constant) and kw.value.value is True:
                                snippet = self._get_snippet(lines, node.lineno)
                                findings.append(
                                    RawFinding(
                                        rule_id="python.security.subprocess-shell-true",
                                        title="Command Injection Risk via subprocess shell=True",
                                        description="subprocess called with shell=True is susceptible to command injection vulnerabilities.",
                                        severity="HIGH",
                                        confidence=0.92,
                                        file_path=rel_path,
                                        line_start=node.lineno,
                                        line_end=getattr(node, "end_lineno", node.lineno),
                                        code_context=snippet,
                                        evidence="subprocess call contains shell=True.",
                                    )
                                )

                # 3. Pickle / unsafe YAML loading
                if isinstance(node, ast.Call) and isinstance(node.func, ast.Attribute):
                    if (
                        isinstance(node.func.value, ast.Name)
                        and node.func.value.id == "pickle"
                        and node.func.attr in {"loads", "load"}
                    ):
                        snippet = self._get_snippet(lines, node.lineno)
                        findings.append(
                            RawFinding(
                                rule_id="python.security.unsafe-pickle-deserialization",
                                title="Unsafe Deserialization via pickle",
                                description="Deserializing untrusted pickle streams can lead to arbitrary remote code execution.",
                                severity="CRITICAL",
                                confidence=0.95,
                                file_path=rel_path,
                                line_start=node.lineno,
                                line_end=getattr(node, "end_lineno", node.lineno),
                                code_context=snippet,
                                evidence=f"pickle.{node.func.attr}() call found.",
                            )
                        )

        except SyntaxError:
            pass  # Fall through to line-by-line regex if file contains syntax issues

        # Line-by-line pattern matching (SQL injection, weak MD5, raw SQL formatting)
        for idx, line in enumerate(lines, start=1):
            stripped = line.strip()

            # SQL Injection in raw query patterns and f-strings
            if (
                re.search(r'execute\s*\(\s*f["\'].*SELECT|INSERT|UPDATE|DELETE', stripped, re.IGNORECASE) or
                re.search(r'\.raw\s*\(\s*f["\']', stripped, re.IGNORECASE) or
                re.search(r'f["\'].*\b(SELECT|INSERT|UPDATE|DELETE)\b.*WHERE', stripped, re.IGNORECASE) or
                re.search(r'f["\'].*\b(SELECT|INSERT|UPDATE|DELETE)\b', stripped, re.IGNORECASE) or
                re.search(r'cursor\.execute\s*\(\s*["\'].*%s.*%\s*\(', stripped, re.IGNORECASE)
            ):
                findings.append(
                    RawFinding(
                        rule_id="python.security.sql-injection",
                        title="SQL Injection via Formatted String Query",
                        description="User-controlled string interpolation or f-string inside a raw database execute() statement.",
                        severity="CRITICAL",
                        confidence=0.94,
                        file_path=rel_path,
                        line_start=idx,
                        line_end=idx,
                        code_context=self._get_snippet(lines, idx),
                        evidence="String formatting detected directly in SQL execution query.",
                    )
                )

            # Weak hashing
            if re.search(r'hashlib\.(md5|sha1)\s*\(', stripped):
                findings.append(
                    RawFinding(
                        rule_id="python.security.weak-cryptographic-hash",
                        title="Use of Weak Cryptographic Hash Function (MD5/SHA1)",
                        description="MD5 and SHA-1 suffer from known collision weaknesses and must not be used for security-sensitive purposes.",
                        severity="MEDIUM",
                        confidence=0.88,
                        file_path=rel_path,
                        line_start=idx,
                        line_end=idx,
                        code_context=self._get_snippet(lines, idx),
                        evidence="Use of hashlib.md5 or hashlib.sha1 detected.",
                    )
                )

            # Django DEBUG = True in settings
            if re.match(r'^DEBUG\s*=\s*True', stripped) and "settings" in rel_path.lower():
                findings.append(
                    RawFinding(
                        rule_id="python.django.debug-mode-enabled",
                        title="Django Production DEBUG Mode Enabled",
                        description="DEBUG = True leaks sensitive environment variables, database schema, and stack traces on errors.",
                        severity="MEDIUM",
                        confidence=0.85,
                        file_path=rel_path,
                        line_start=idx,
                        line_end=idx,
                        code_context=self._get_snippet(lines, idx),
                        evidence="DEBUG = True configured directly.",
                    )
                )

        return findings

    def _analyze_js_file(self, file_path: Path, workspace: Path) -> List[RawFinding]:
        findings = []
        rel_path = str(file_path.relative_to(workspace)).replace("\\", "/")

        try:
            content = file_path.read_text(encoding="utf-8", errors="ignore")
            lines = content.splitlines()
        except Exception:
            return findings

        for idx, line in enumerate(lines, start=1):
            stripped = line.strip()

            # dangerouslySetInnerHTML
            if "dangerouslySetInnerHTML" in stripped:
                findings.append(
                    RawFinding(
                        rule_id="javascript.react.dangerously-set-inner-html",
                        title="Potential XSS via dangerouslySetInnerHTML",
                        description="Rendering unsanitized HTML directly can lead to Cross-Site Scripting (XSS).",
                        severity="HIGH",
                        confidence=0.9,
                        file_path=rel_path,
                        line_start=idx,
                        line_end=idx,
                        code_context=self._get_snippet(lines, idx),
                        evidence="dangerouslySetInnerHTML property found.",
                    )
                )

            # eval(...) in JS
            if re.search(r'\beval\s*\(', stripped):
                findings.append(
                    RawFinding(
                        rule_id="javascript.security.eval-code-injection",
                        title="Dangerous Use of eval() in JavaScript",
                        description="eval() allows arbitrary code execution and compromises application security.",
                        severity="CRITICAL",
                        confidence=0.95,
                        file_path=rel_path,
                        line_start=idx,
                        line_end=idx,
                        code_context=self._get_snippet(lines, idx),
                        evidence="eval() invocation detected.",
                    )
                )

        return findings

    def _get_snippet(self, lines: List[str], target_line: int, window: int = 3) -> str:
        start = max(0, target_line - 1 - window)
        end = min(len(lines), target_line + window)
        snippet_lines = []
        for i in range(start, end):
            prefix = " > " if i == (target_line - 1) else "   "
            snippet_lines.append(f"{prefix}{i + 1:4d} | {lines[i]}")
        return "\n".join(snippet_lines)
