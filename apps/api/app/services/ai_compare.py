"""Vision LLM advisory analysis and comparison helpers."""

from __future__ import annotations

import base64
import json
import re
from typing import Any

import cv2
import httpx
import numpy as np

from app.models.db import AnalysisType
from app.services.ai_settings import ResolvedAiConfig, resolve_ai_config


PROMPTS = {
    AnalysisType.grain_size: (
        "You are a metallography expert. Estimate apparent grain size per ISO 643. "
        "Return JSON with keys: grain_size_number_G (number), mean_intercept_um (number), "
        "confidence (0-1), observations (string), caveats (string)."
    ),
    AnalysisType.inclusion: (
        "Estimate non-metallic inclusion rating per ISO 4967 chart method. "
        "Return JSON with keys: worst_severity_index (0-5), type_counts (object A/B/C/D/DS), "
        "confidence (0-1), observations (string), caveats (string)."
    ),
    AnalysisType.decarb: (
        "Estimate decarburization depth per ISO 3887 from the metallograph. "
        "Return JSON with keys: decarb_depth_um (number), confidence (0-1), "
        "observations (string), caveats (string)."
    ),
    AnalysisType.micro: (
        "Describe microstructure phase fractions. Return JSON with keys: "
        "light_phase_fraction (0-1), dark_phase_fraction (0-1), confidence (0-1), "
        "observations (string), caveats (string)."
    ),
    AnalysisType.macro: (
        "Assess macroscopic inclusions per IS 10138. Return JSON with keys: "
        "stringer_count (int), total_length_mm (number), confidence (0-1), "
        "observations (string), caveats (string)."
    ),
}

DEEPSEEK_VISION_MODEL = "deepseek-v4-flash-vision-exp"
DEEPSEEK_TEXT_ONLY_MODELS = frozenset(
    {
        "deepseek-chat",
        "deepseek-reasoner",
        "deepseek-v4-flash",
        "deepseek-v4-pro",
    }
)


def _encode_jpeg_b64(image_bgr: np.ndarray) -> str:
    ok, buf = cv2.imencode(".jpg", image_bgr, [int(cv2.IMWRITE_JPEG_QUALITY), 85])
    if not ok:
        raise ValueError("Failed to encode image")
    return base64.b64encode(buf.tobytes()).decode("ascii")


def _vision_model(ai_config: ResolvedAiConfig) -> str:
    model = ai_config["model"]
    if ai_config["provider"] != "deepseek":
        return model
    if "vision" in model.lower():
        return model
    if model in DEEPSEEK_TEXT_ONLY_MODELS or model.startswith("deepseek-"):
        return DEEPSEEK_VISION_MODEL
    return model


def _parse_json_content(content: str) -> dict[str, Any]:
    content = content.strip()
    if content.startswith("```"):
        content = re.sub(r"^```(?:json)?\s*", "", content)
        content = re.sub(r"\s*```$", "", content).strip()
    if not content:
        raise json.JSONDecodeError("Empty AI response content", content, 0)
    try:
        return json.loads(content)
    except json.JSONDecodeError:
        match = re.search(r"\{.*\}", content, re.DOTALL)
        if match:
            return json.loads(match.group(0))
        raise


def _message_text(data: dict[str, Any]) -> str:
    message = data["choices"][0]["message"]
    content = (message.get("content") or "").strip()
    if content:
        return content
    reasoning = (message.get("reasoning_content") or "").strip()
    if reasoning:
        return reasoning
    raise ValueError("AI returned an empty response")


async def _post_chat(
    ai_config: ResolvedAiConfig,
    *,
    model: str,
    messages: list[dict[str, Any]],
    json_mode: bool = True,
) -> dict[str, Any]:
    payload: dict[str, Any] = {
        "model": model,
        "messages": messages,
        "max_tokens": 1200,
    }
    if ai_config["provider"] == "deepseek":
        payload["thinking"] = {"type": "disabled"}
    if json_mode and ai_config["provider"] == "openai":
        payload["response_format"] = {"type": "json_object"}

    async with httpx.AsyncClient(timeout=90.0) as client:
        resp = await client.post(
            ai_config["base_url"],
            headers={"Authorization": f"Bearer {ai_config['api_key']}"},
            json=payload,
        )
        if resp.status_code >= 400:
            detail = resp.text[:500]
            raise httpx.HTTPStatusError(
                f"AI API error ({resp.status_code}): {detail}",
                request=resp.request,
                response=resp,
            )
        if not resp.content:
            raise ValueError("AI API returned an empty response body")
        try:
            return resp.json()
        except json.JSONDecodeError as exc:
            raise ValueError(f"AI API returned invalid JSON: {resp.text[:200]}") from exc


async def _vision_analysis(
    ai_config: ResolvedAiConfig,
    analysis_type: AnalysisType,
    image_bgr: np.ndarray,
) -> dict[str, Any]:
    prompt = PROMPTS.get(analysis_type, PROMPTS[AnalysisType.grain_size])
    b64 = _encode_jpeg_b64(image_bgr)
    model = _vision_model(ai_config)
    messages = [
        {
            "role": "user",
            "content": [
                {"type": "text", "text": prompt + " Respond with JSON only."},
                {
                    "type": "image_url",
                    "image_url": {"url": f"data:image/jpeg;base64,{b64}"},
                },
            ],
        }
    ]
    data = await _post_chat(ai_config, model=model, messages=messages, json_mode=True)
    content = _message_text(data)
    parsed = _parse_json_content(content)
    parsed["provider"] = ai_config["provider"]
    parsed["model"] = model
    parsed["advisory"] = True
    return parsed


async def _text_advisory(
    ai_config: ResolvedAiConfig,
    analysis_type: AnalysisType,
    software_context: dict[str, Any],
    *,
    reason: str,
) -> dict[str, Any]:
    prompt = PROMPTS.get(analysis_type, PROMPTS[AnalysisType.grain_size])
    model = ai_config["model"]
    if ai_config["provider"] == "deepseek" and model == DEEPSEEK_VISION_MODEL:
        model = "deepseek-v4-flash"

    text_prompt = (
        f"{prompt}\n\n"
        "You cannot see the image directly. Use the software analysis below as reference "
        "and provide an independent advisory opinion with reasonable numeric estimates.\n"
        f"Software analysis JSON:\n{json.dumps(software_context, default=str)}\n\n"
        "Respond with JSON only."
    )
    messages = [{"role": "user", "content": text_prompt}]
    data = await _post_chat(ai_config, model=model, messages=messages, json_mode=False)
    content = _message_text(data)
    parsed = _parse_json_content(content)
    parsed["provider"] = ai_config["provider"]
    parsed["model"] = model
    parsed["advisory"] = True
    parsed["caveats"] = (
        f"{parsed.get('caveats', '')} Vision call unavailable; text advisory used. {reason}"
    ).strip()
    return parsed


async def run_ai_analysis(
    analysis_type: AnalysisType,
    image_bgr: np.ndarray,
    *,
    org_branding: dict[str, Any] | None = None,
    software_context: dict[str, Any] | None = None,
) -> dict[str, Any]:
    ai_config = resolve_ai_config(org_branding)
    if not ai_config:
        return {
            "provider": "heuristic_fallback",
            "advisory": True,
            "confidence": 0.35,
            "observations": "AI API Key Not Configured. AI Advisory Skipped; Use Software Result as Primary.",
            "caveats": "Add a DeepSeek or OpenAI API Key in Admin → AI Settings.",
        }

    try:
        return await _vision_analysis(ai_config, analysis_type, image_bgr)
    except Exception as vision_err:
        if software_context:
            try:
                return await _text_advisory(
                    ai_config,
                    analysis_type,
                    software_context,
                    reason=str(vision_err),
                )
            except Exception:
                pass
        return {
            "provider": ai_config["provider"],
            "model": ai_config["model"],
            "advisory": True,
            "confidence": 0.2,
            "observations": "AI Advisory Unavailable. Use Software Result as Primary.",
            "caveats": str(vision_err),
        }


def compare_results(analysis_type: AnalysisType, software: dict[str, Any], ai: dict[str, Any]) -> dict[str, Any]:
    deltas: dict[str, Any] = {}
    keys = {
        AnalysisType.grain_size: ["grain_size_number_G", "mean_intercept_um"],
        AnalysisType.inclusion: ["worst_severity_index"],
        AnalysisType.decarb: ["decarb_depth_um"],
        AnalysisType.micro: ["light_phase_fraction", "dark_phase_fraction"],
        AnalysisType.macro: ["stringer_count", "total_length_mm"],
    }.get(analysis_type, [])

    for key in keys:
        s_val = software.get(key)
        a_val = ai.get(key)
        if isinstance(s_val, (int, float)) and isinstance(a_val, (int, float)):
            deltas[key] = {
                "software": s_val,
                "ai": a_val,
                "absolute_diff": round(float(a_val) - float(s_val), 4),
            }

    agreement = "unknown"
    if deltas:
        rel = []
        for d in deltas.values():
            base = abs(d["software"]) if d["software"] else 1.0
            rel.append(abs(d["absolute_diff"]) / base)
        mean_rel = sum(rel) / len(rel)
        agreement = "high" if mean_rel < 0.15 else "medium" if mean_rel < 0.4 else "low"

    return {
        "primary": "software",
        "ai_role": "advisory",
        "agreement": agreement,
        "deltas": deltas,
        "summary": f"Software is primary (standards-oriented). AI agreement: {agreement}.",
    }
