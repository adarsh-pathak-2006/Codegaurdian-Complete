"""
CodeGuardian Risk Engine
Calculates finding-level risk and project-level aggregate security scores according to specification.
"""
from typing import Dict, Any, List


SEVERITY_WEIGHTS = {
    "CRITICAL": 10,
    "HIGH": 7,
    "MEDIUM": 4,
    "LOW": 1,
    "INFORMATIONAL": 0,
}


def clamp(val: float, min_val: float = 0.0, max_val: float = 100.0) -> float:
    return max(min_val, min(max_val, val))


def calculate_finding_score(
    severity: str,
    confidence: float = 0.8,
    exposure_weight: float = 0.0,
    exploitability_weight: float = 0.0,
) -> float:
    """
    Computes an individual finding's risk score (0-100).
    base = severity_weight * 10
    confidence_adjustment = confidence * 0.20
    exposure_adjustment = exposure_weight
    fix_adjustment = exploitability_or_impact_weight
    finding_score = clamp(base + confidence_adjustment + exposure_adjustment + fix_adjustment, 0, 100)
    """
    severity_norm = severity.upper()
    severity_weight = SEVERITY_WEIGHTS.get(severity_norm, 4)
    base = severity_weight * 10
    confidence_adjustment = confidence * 0.20 * 10  # scaled
    finding_score = clamp(base + confidence_adjustment + exposure_weight + exploitability_weight, 0.0, 100.0)
    return round(finding_score, 2)


def calculate_project_risk_score(
    critical_count: int,
    high_count: int,
    medium_count: int,
    low_count: int,
) -> int:
    """
    Calculates overall project security health score (0-100, where 100 is cleanest).
    project_score = clamp(
        100
        - critical_count * 20
        - high_count * 10
        - medium_count * 3
        - low_count * 1,
        0, 100
    )
    """
    deduction = (
        critical_count * 20
        + high_count * 10
        + medium_count * 3
        + low_count * 1
    )
    score = clamp(100 - deduction, 0, 100)
    return int(score)


def normalize_severity(raw_severity: str) -> str:
    """
    Normalizes heterogeneous scanner severity ratings into standard 4-tier (+ info) model:
    CRITICAL, HIGH, MEDIUM, LOW, INFORMATIONAL
    """
    raw = str(raw_severity).strip().upper()
    if raw in {"CRITICAL", "BLOCKER"}:
        return "CRITICAL"
    if raw in {"HIGH", "ERROR"}:
        return "HIGH"
    if raw in {"MEDIUM", "MODERATE", "WARNING"}:
        return "MEDIUM"
    if raw in {"LOW", "INFO", "INFORMATIONAL", "NOTE"}:
        return "LOW" if raw == "LOW" else "INFORMATIONAL"
    return "MEDIUM"
