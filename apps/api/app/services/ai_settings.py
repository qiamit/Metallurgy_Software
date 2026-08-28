"""Organization AI provider settings (stored in Organization.branding['ai'])."""

from __future__ import annotations

from typing import Any, TypedDict

from app.core.config import get_settings


class ResolvedAiConfig(TypedDict):
    provider: str
    api_key: str
    model: str
    base_url: str


PROVIDER_DEFAULTS: dict[str, dict[str, str]] = {
    "deepseek": {
        "base_url": "https://api.deepseek.com/chat/completions",
        "model": "deepseek-v4-flash-vision-exp",
    },
    "openai": {
        "base_url": "https://api.openai.com/v1/chat/completions",
        "model": "gpt-4o-mini",
    },
}


def _mask_api_key(key: str) -> str:
    if len(key) <= 4:
        return "••••"
    return f"••••{key[-4:]}"


def read_org_ai_settings(branding: dict[str, Any] | None) -> dict[str, Any]:
    ai = dict((branding or {}).get("ai") or {})
    provider = str(ai.get("provider") or "deepseek").lower()
    defaults = PROVIDER_DEFAULTS.get(provider, PROVIDER_DEFAULTS["deepseek"])
    api_key = ai.get("api_key")
    return {
        "provider": provider,
        "model": str(ai.get("model") or defaults["model"]),
        "api_key": api_key if isinstance(api_key, str) and api_key.strip() else None,
    }


def ai_settings_public(branding: dict[str, Any] | None) -> dict[str, Any]:
    ai = read_org_ai_settings(branding)
    key = ai["api_key"]
    return {
        "provider": ai["provider"],
        "model": ai["model"],
        "configured": bool(key),
        "api_key_hint": _mask_api_key(key) if key else None,
    }


def merge_org_ai_settings(
    branding: dict[str, Any] | None,
    *,
    provider: str,
    model: str | None,
    api_key: str | None,
    clear_key: bool,
) -> dict[str, Any]:
    merged = dict(branding or {})
    current = read_org_ai_settings(merged)
    next_ai: dict[str, Any] = {
        "provider": provider.lower(),
        "model": model or current["model"] or PROVIDER_DEFAULTS.get(provider.lower(), PROVIDER_DEFAULTS["deepseek"])["model"],
    }
    if clear_key:
        next_ai["api_key"] = None
    elif api_key and api_key.strip():
        next_ai["api_key"] = api_key.strip()
    elif current["api_key"]:
        next_ai["api_key"] = current["api_key"]
    else:
        next_ai["api_key"] = None
    merged["ai"] = next_ai
    return merged


def resolve_ai_config(branding: dict[str, Any] | None) -> ResolvedAiConfig | None:
    org_ai = read_org_ai_settings(branding)
    settings = get_settings()

    api_key = org_ai["api_key"] or settings.openai_api_key
    if not api_key:
        return None

    if org_ai["api_key"]:
        provider = org_ai["provider"]
    else:
        provider = "openai"

    defaults = PROVIDER_DEFAULTS.get(provider, PROVIDER_DEFAULTS["openai"])
    model = org_ai["model"] if org_ai["api_key"] else settings.openai_model
    if not model:
        model = defaults["model"]

    return ResolvedAiConfig(
        provider=provider,
        api_key=api_key,
        model=model,
        base_url=defaults["base_url"],
    )
