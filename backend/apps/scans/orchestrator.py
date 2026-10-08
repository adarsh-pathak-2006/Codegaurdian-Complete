import logging
import time
from datetime import datetime, timezone
from typing import List

from apps.risk.engine import calculate_project_risk_score
from apps.scanners.base import ScanConfig, ScannerResult
from apps.scanners.normalizer import FindingNormalizer
from apps.scanners.sast_adapter import SASTScannerAdapter
from apps.scanners.sca_adapter import SCAScannerAdapter
from apps.scanners.secrets_adapter import SecretScannerAdapter
from .models import Scan, ScanJob, ScanStatus
from .workspace import WorkspaceManager

logger = logging.getLogger(__name__)


class ScanOrchestrator:
    """
    Executes the multi-stage security scanning pipeline:
    QUEUED -> PREPARING -> SCANNING -> NORMALIZING -> SCORING -> COMPLETED / FAILED
    """

    def __init__(self, scan: Scan):
        self.scan = scan
        self.workspace_mgr = WorkspaceManager()
        self.sast_adapter = SASTScannerAdapter()
        self.secrets_adapter = SecretScannerAdapter()
        self.sca_adapter = SCAScannerAdapter()
        self.normalizer = FindingNormalizer()

    def run(self):
        self.scan.status = ScanStatus.PREPARING
        self.scan.started_at = datetime.now(timezone.utc)
        self.scan.save(update_fields=["status", "started_at"])

        try:
            # 1. Prepare Workspace
            prep_job = self._create_job("prepare")
            workspace_path = self.workspace_mgr.prepare_workspace(
                self.scan.project.repo_url, ref=self.scan.ref
            )
            self._complete_job(prep_job)

            # 2. Scanning Stage
            self.scan.status = ScanStatus.SCANNING
            self.scan.save(update_fields=["status"])

            scan_config = ScanConfig(
                profile=self.scan.profile,
                workspace_path=workspace_path,
            )

            scanner_results: List[ScannerResult] = []

            # 2a. SAST scan
            sast_job = self._create_job("sast")
            sast_result = self.sast_adapter.scan(workspace_path, scan_config)
            scanner_results.append(sast_result)
            self._complete_job(sast_job, sast_result.duration_ms)

            # 2b. Secrets scan
            sec_job = self._create_job("secrets")
            sec_result = self.secrets_adapter.scan(workspace_path, scan_config)
            scanner_results.append(sec_result)
            self._complete_job(sec_job, sec_result.duration_ms)

            # 2c. SCA scan
            sca_job = self._create_job("dependencies")
            sca_result = self.sca_adapter.scan(workspace_path, scan_config)
            scanner_results.append(sca_result)
            self._complete_job(sca_job, sca_result.duration_ms)

            # 3. Normalizing Stage
            self.scan.status = ScanStatus.NORMALIZING
            self.scan.save(update_fields=["status"])
            norm_job = self._create_job("normalize")

            norm_stats = self.normalizer.process_and_persist(self.scan, scanner_results)
            self._complete_job(norm_job)

            # 4. Scoring Stage
            self.scan.status = ScanStatus.SCORING
            self.scan.save(update_fields=["status"])
            score_job = self._create_job("score")

            project_score = calculate_project_risk_score(
                critical_count=self.scan.critical_count,
                high_count=self.scan.high_count,
                medium_count=self.scan.medium_count,
                low_count=self.scan.low_count,
            )
            self.scan.risk_score = project_score
            self._complete_job(score_job)

            # 5. Completed
            self.scan.status = ScanStatus.COMPLETED
            self.scan.completed_at = datetime.now(timezone.utc)
            self.scan.save(update_fields=["status", "risk_score", "completed_at"])

            logger.info(
                f"Scan {self.scan.id} completed. Risk Score: {project_score}/100. "
                f"Findings: {norm_stats['counts']}"
            )

        except Exception as e:
            logger.exception(f"Scan {self.scan.id} failed: {e}")
            self.scan.status = ScanStatus.FAILED
            self.scan.error_message = str(e)
            self.scan.completed_at = datetime.now(timezone.utc)
            self.scan.save(update_fields=["status", "error_message", "completed_at"])
            raise e

        finally:
            self.workspace_mgr.cleanup()

    def _create_job(self, stage: str) -> ScanJob:
        return ScanJob.objects.create(
            scan=self.scan,
            stage=stage,
            status="running",
            started_at=datetime.now(timezone.utc),
        )

    def _complete_job(self, job: ScanJob, duration_ms: int = 0):
        job.status = "completed"
        job.completed_at = datetime.now(timezone.utc)
        if duration_ms:
            job.duration_ms = duration_ms
        elif job.started_at:
            delta = job.completed_at - job.started_at
            job.duration_ms = int(delta.total_seconds() * 1000)
        job.save()
