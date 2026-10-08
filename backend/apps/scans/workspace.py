import os
import shutil
import subprocess
import tempfile
import zipfile
from pathlib import Path
from typing import Optional


class WorkspaceManager:
    """
    Manages safe preparation and teardown of isolated scan target workspaces.
    Hardened against path traversal and malicious archives.
    """

    def __init__(self, base_temp_dir: Optional[str] = None):
        self.base_temp_dir = base_temp_dir or tempfile.gettempdir()
        self.workspace_path: Optional[Path] = None

    def prepare_workspace(self, repo_url_or_path: str, ref: str = "main") -> Path:
        """
        Creates an isolated temporary folder and populates it from Git URL, local directory, or archive.
        """
        temp_dir = tempfile.mkdtemp(prefix="cg_scan_", dir=self.base_temp_dir)
        self.workspace_path = Path(temp_dir)

        path_candidate = Path(repo_url_or_path)

        # 1. Local zip archive
        if path_candidate.is_file() and path_candidate.suffix.lower() == ".zip":
            self._extract_safe_zip(path_candidate, self.workspace_path)
            return self.workspace_path

        # 2. Local directory
        if path_candidate.is_dir():
            self._copy_local_directory(path_candidate, self.workspace_path)
            return self.workspace_path

        # 3. Remote Git repository URL
        if repo_url_or_path.startswith("http://") or repo_url_or_path.startswith("https://") or repo_url_or_path.startswith("git@"):
            self._clone_git_repo(repo_url_or_path, ref, self.workspace_path)
            return self.workspace_path

        # If repo_url_or_path is empty or not found, return empty workspace
        return self.workspace_path

    def _clone_git_repo(self, repo_url: str, ref: str, dest: Path):
        cmd = [
            "git",
            "clone",
            "--depth", "1",
            "--branch", ref,
            repo_url,
            str(dest),
        ]
        try:
            subprocess.run(cmd, capture_output=True, text=True, check=True, timeout=180)
        except subprocess.CalledProcessError as e:
            # Fallback to cloning without branch if specific branch not found
            fallback_cmd = ["git", "clone", "--depth", "1", repo_url, str(dest)]
            subprocess.run(fallback_cmd, capture_output=True, text=True, check=True, timeout=180)

    def _copy_local_directory(self, src: Path, dest: Path):
        ignored = shutil.ignore_patterns(".git", "__pycache__", "node_modules", ".venv", "venv")
        shutil.copytree(src, dest, dirs_exist_ok=True, ignore=ignored)

    def _extract_safe_zip(self, zip_path: Path, dest: Path):
        """
        Extracts ZIP preventing Zip-Slip (directory traversal attacks).
        """
        resolved_dest = dest.resolve()
        with zipfile.ZipFile(zip_path, "r") as zf:
            for member in zf.infolist():
                target_path = (dest / member.filename).resolve()
                if not str(target_path).startswith(str(resolved_dest)):
                    raise ValueError(f"Zip slip path traversal attempt detected: {member.filename}")
            zf.extractall(dest)

    def cleanup(self):
        """Cleans up the temporary scan workspace."""
        if self.workspace_path and self.workspace_path.exists():
            try:
                shutil.rmtree(self.workspace_path, ignore_errors=True)
            except Exception:
                pass
            self.workspace_path = None
