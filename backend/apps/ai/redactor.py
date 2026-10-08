import re
from apps.scanners.secrets_adapter import SecretScannerAdapter, mask_secret


def redact_sensitive_data(text: str) -> str:
    """
    Redacts exposed API tokens, passwords, private keys and AWS credentials
    from source code snippets before transmitting them to LLM prompts.
    """
    if not text:
        return ""

    redacted = text
    for rule_id, title, pattern, severity in SecretScannerAdapter.PATTERNS:
        matches = list(re.finditer(pattern, redacted))
        for m in reversed(matches):
            raw = m.group(0)
            masked = f"[REDACTED_SECRET_{mask_secret(raw)}]"
            redacted = redacted[: m.start()] + masked + redacted[m.end() :]

    return redacted
