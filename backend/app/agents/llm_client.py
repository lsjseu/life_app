from __future__ import annotations

import json
import os
import urllib.error
import urllib.request
from dataclasses import dataclass
from typing import Any


@dataclass
class LLMResponse:
    content: str
    quick_actions: list[str]
    model: str


class LLMClientError(RuntimeError):
    pass


class DeepSeekClient:
    def __init__(self) -> None:
        self.provider = os.getenv("GENERAL_AGENT_PROVIDER") or os.getenv("LLM_PROVIDER", "deepseek")
        self.model = os.getenv("GENERAL_AGENT_MODEL") or os.getenv("QUICK_THINK_LLM", "deepseek-chat")
        self.base_url = (os.getenv("LLM_BACKEND_URL") or "https://api.deepseek.com/v1").rstrip("/")
        self.api_key = os.getenv("DEEPSEEK_API_KEY") or os.getenv("LLM_API_KEY", "")
        self.timeout = float(os.getenv("LLM_TIMEOUT_SECONDS", "20"))

    @property
    def enabled(self) -> bool:
        return self.provider == "deepseek" and bool(self.api_key)

    def chat_json(self, messages: list[dict[str, str]], temperature: float = 0.2) -> LLMResponse:
        if not self.enabled:
            raise LLMClientError("DeepSeek is not configured. Set LLM_API_KEY or DEEPSEEK_API_KEY.")

        payload = {
            "model": self.model,
            "messages": messages,
            "temperature": temperature,
            "response_format": {"type": "json_object"},
        }
        request = urllib.request.Request(
            f"{self.base_url}/chat/completions",
            data=json.dumps(payload, ensure_ascii=False).encode("utf-8"),
            headers={
                "Authorization": f"Bearer {self.api_key}",
                "Content-Type": "application/json",
            },
            method="POST",
        )
        try:
            with urllib.request.urlopen(request, timeout=self.timeout) as response:
                body = response.read().decode("utf-8")
        except urllib.error.HTTPError as exc:
            detail = exc.read().decode("utf-8", errors="ignore")
            raise LLMClientError(f"DeepSeek HTTP {exc.code}: {detail[:300]}") from exc
        except urllib.error.URLError as exc:
            raise LLMClientError(f"DeepSeek request failed: {exc.reason}") from exc

        try:
            data = json.loads(body)
            raw_content = data["choices"][0]["message"]["content"]
        except (KeyError, IndexError, json.JSONDecodeError, TypeError) as exc:
            raise LLMClientError("DeepSeek returned an invalid response.") from exc

        parsed = _loads_json_object(raw_content)
        content = str(parsed.get("content") or raw_content).strip()
        quick_actions = parsed.get("quick_actions")
        if not isinstance(quick_actions, list):
            quick_actions = []
        quick_actions = [str(item)[:12] for item in quick_actions[:3] if str(item).strip()]
        return LLMResponse(content=content, quick_actions=quick_actions, model=self.model)


def _loads_json_object(value: str) -> dict[str, Any]:
    try:
        parsed = json.loads(value)
        return parsed if isinstance(parsed, dict) else {}
    except json.JSONDecodeError:
        start = value.find("{")
        end = value.rfind("}")
        if start >= 0 and end > start:
            try:
                parsed = json.loads(value[start : end + 1])
                return parsed if isinstance(parsed, dict) else {}
            except json.JSONDecodeError:
                return {}
        return {}

