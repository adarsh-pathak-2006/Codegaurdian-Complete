import json
import logging
import os
from abc import ABC, abstractmethod
from typing import Dict, Any
import requests

logger = logging.getLogger(__name__)


class BaseAIProvider(ABC):
    @abstractmethod
    def generate_remediation(self, prompt: str, system_prompt: str) -> Dict[str, Any]:
        """Generates structured explanation and remediation JSON."""
        pass


class MockAIProvider(BaseAIProvider):
    """
    Deterministic fallback provider for testing and offline environments.
    Returns high-fidelity security explanations based on rule IDs.
    """
    def generate_remediation(self, prompt: str, system_prompt: str) -> Dict[str, Any]:
        if "sql" in prompt.lower():
            return {
                "summary": "Untrusted input concatenated into SQL query string.",
                "why_it_is_a_problem": "Directly embedding variables into database queries enables SQL injection, allowing attackers to bypass authentication, read or modify data, or execute administrative operations.",
                "attack_scenario": "An attacker supplies a payload like `' OR '1'='1` in the request parameters to extract database records.",
                "recommended_fix": "Use parameterized queries, Django ORM filters, or prepared statements with placeholder parameters instead of string formatting.",
                "patch_strategy": "Replace raw cursor string interpolation with parameterized cursor.execute('SELECT ... WHERE id = %s', [user_id]).",
                "confidence": 0.95,
                "needs_human_review": True,
            }
        elif "eval" in prompt.lower() or "exec" in prompt.lower():
            return {
                "summary": "Arbitrary code execution via dynamic eval()/exec().",
                "why_it_is_a_problem": "Evaluating arbitrary dynamic strings allows attackers to execute system-level Python commands inside the runtime environment.",
                "attack_scenario": "An attacker sends malicious Python code (e.g., `__import__('os').system('cat /etc/passwd')`) causing remote code execution.",
                "recommended_fix": "Avoid eval() entirely. Use ast.literal_eval() for safe literal parsing or dedicated parsers like json.loads().",
                "patch_strategy": "Replace eval(data) with ast.literal_eval(data) or json.loads(data).",
                "confidence": 0.98,
                "needs_human_review": True,
            }
        elif "secret" in prompt.lower() or "key" in prompt.lower():
            return {
                "summary": "Hardcoded secret or credential exposed in repository.",
                "why_it_is_a_problem": "Credentials in version control can be accessed by unauthorized collaborators or leaked publicly, resulting in complete cloud infrastructure takeover.",
                "attack_scenario": "An adversary clones the repository or inspects git history to obtain valid cloud/API tokens.",
                "recommended_fix": "Revoke and rotate the exposed credential immediately. Move credentials to environment variables or a secret manager.",
                "patch_strategy": "Rotate the key. Read from os.environ.get('SECRET_KEY') or AWS Secrets Manager.",
                "confidence": 0.99,
                "needs_human_review": True,
            }
        else:
            return {
                "summary": "Security weakness identified in application source.",
                "why_it_is_a_problem": "The identified pattern does not adhere to secure coding practices and may allow attackers to compromise system confidentiality or integrity.",
                "attack_scenario": "An adversary manipulates input parameters to trigger unexpected behavior or bypass controls.",
                "recommended_fix": "Validate all inputs against strict allowlists and apply defense-in-depth principles.",
                "patch_strategy": "Apply defensive input validation and sanitize all parameters before consumption.",
                "confidence": 0.85,
                "needs_human_review": True,
            }


class OllamaProvider(BaseAIProvider):
    def __init__(self, host: str = "http://localhost:11434", model: str = "llama3.2"):
        self.host = host
        self.model = model

    def generate_remediation(self, prompt: str, system_prompt: str) -> Dict[str, Any]:
        url = f"{self.host}/api/generate"
        payload = {
            "model": self.model,
            "system": system_prompt,
            "prompt": prompt,
            "format": "json",
            "stream": False,
        }
        try:
            resp = requests.post(url, json=payload, timeout=60)
            if resp.status_code == 200:
                raw_text = resp.json().get("response", "{}")
                return json.loads(raw_text)
        except Exception as e:
            logger.warning(f"Ollama provider failed: {e}. Falling back to MockAIProvider.")
        return MockAIProvider().generate_remediation(prompt, system_prompt)


def _clean_json_text(text: str) -> str:
    cleaned = text.strip()
    if cleaned.startswith("```json"):
        cleaned = cleaned[7:]
    elif cleaned.startswith("```"):
        cleaned = cleaned[3:]
    if cleaned.endswith("```"):
        cleaned = cleaned[:-3]
    return cleaned.strip()


class GeminiProvider(BaseAIProvider):
    """
    Native Google Gemini provider supporting Gemini 1.5/2.0 models
    using Google's official REST API with JSON schema mode.
    """
    def __init__(self, api_key: str, model: str = "gemini-1.5-flash"):
        self.api_key = api_key
        self.model = model

    def generate_remediation(self, prompt: str, system_prompt: str) -> Dict[str, Any]:
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{self.model}:generateContent?key={self.api_key}"
        headers = {"Content-Type": "application/json"}
        payload = {
            "contents": [
                {
                    "role": "user",
                    "parts": [{"text": f"{system_prompt}\n\n{prompt}"}]
                }
            ],
            "generationConfig": {
                "responseMimeType": "application/json",
                "temperature": 0.2,
            }
        }
        try:
            resp = requests.post(url, headers=headers, json=payload, timeout=45)
            if resp.status_code == 200:
                data = resp.json()
                text = data["candidates"][0]["content"]["parts"][0]["text"]
                return json.loads(_clean_json_text(text))
            else:
                logger.warning(f"Gemini API returned HTTP {resp.status_code}: {resp.text}")
        except Exception as e:
            logger.warning(f"Gemini provider failed: {e}. Falling back to MockAIProvider.")
        return MockAIProvider().generate_remediation(prompt, system_prompt)


class OpenAICompatibleProvider(BaseAIProvider):
    def __init__(self, api_key: str, base_url: str = "https://api.openai.com/v1", model: str = "gpt-4o-mini"):
        self.api_key = api_key
        self.base_url = base_url
        self.model = model

    def generate_remediation(self, prompt: str, system_prompt: str) -> Dict[str, Any]:
        url = f"{self.base_url}/chat/completions"
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }
        payload = {
            "model": self.model,
            "response_format": {"type": "json_object"},
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": prompt},
            ],
            "temperature": 0.2,
        }
        try:
            resp = requests.post(url, headers=headers, json=payload, timeout=45)
            if resp.status_code == 200:
                data = resp.json()
                content = data["choices"][0]["message"]["content"]
                return json.loads(_clean_json_text(content))
        except Exception as e:
            logger.warning(f"OpenAI provider failed: {e}. Falling back to MockAIProvider.")
        return MockAIProvider().generate_remediation(prompt, system_prompt)


def get_ai_provider() -> BaseAIProvider:
    """Factory selecting configured AI provider based on environment."""
    provider_type = os.environ.get("AI_PROVIDER", "").lower()

    # 1. Google Gemini
    gemini_key = os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY")
    if provider_type in {"gemini", "google"} or (gemini_key and not provider_type):
        key = gemini_key or os.environ.get("AI_API_KEY", "")
        model = os.environ.get("GEMINI_MODEL") or os.environ.get("AI_MODEL", "gemini-1.5-flash")
        if key:
            return GeminiProvider(api_key=key, model=model)

    # 2. OpenAI or custom OpenAI-compatible endpoint
    openai_key = os.environ.get("OPENAI_API_KEY") or os.environ.get("AI_API_KEY")
    if provider_type == "openai" or (openai_key and not provider_type):
        base_url = os.environ.get("AI_BASE_URL", "https://api.openai.com/v1")
        model = os.environ.get("OPENAI_MODEL") or os.environ.get("AI_MODEL", "gpt-4o-mini")
        if openai_key:
            return OpenAICompatibleProvider(api_key=openai_key, base_url=base_url, model=model)

    # 3. Local Ollama
    if provider_type == "ollama":
        host = os.environ.get("OLLAMA_HOST", "http://localhost:11434")
        model = os.environ.get("OLLAMA_MODEL", "llama3.2")
        return OllamaProvider(host=host, model=model)

    # 4. Default high-fidelity deterministic offline provider
    return MockAIProvider()

