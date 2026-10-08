import logging
from celery import shared_task
from .models import Scan, ScanJob
from .orchestrator import ScanOrchestrator

logger = logging.getLogger(__name__)


@shared_task(bind=True, name="apps.scans.tasks.run_scan")
def run_scan(self, scan_id: str):
    logger.info(f"Starting Celery scan task for scan_id: {scan_id}")
    try:
        scan = Scan.objects.get(id=scan_id)
        orchestrator = ScanOrchestrator(scan)
        orchestrator.run()
        return {
            "scan_id": str(scan.id),
            "status": scan.status,
            "risk_score": scan.risk_score,
            "critical_count": scan.critical_count,
            "high_count": scan.high_count,
            "medium_count": scan.medium_count,
            "low_count": scan.low_count,
        }
    except Scan.DoesNotExist:
        logger.error(f"Scan with ID {scan_id} does not exist.")
        return {"error": f"Scan {scan_id} not found"}
    except Exception as e:
        logger.exception(f"Error in Celery scan task for {scan_id}: {e}")
        return {"scan_id": scan_id, "status": "FAILED", "error": str(e)}
