"""Vision LLM advisory analysis and comparison helpers."""

from __future__ import annotations

import base64
import json
from typing import Any

import cv2
import httpx
import numpy as np

from app.core.config import get_settings
from app.models.db import AnalysisType


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


def _encode_jpeg_b64(image_bgr: np.ndarray) -> str:
    ok, buf = cv2.imencode(".jpg", image_bgr, [int(cv2.IMWRITE_JPEG_QUALITY), 85])
    if not ok:
        raise ValueError("Failed to encode image")
    return base64.b64encode(buf.tobytes()).decode("ascii")


async def run_ai_analysis(analysis_type: AnalysisType, image_bgr: np.ndarray) -> dict[str, Any]:
    settings = get_settings()
    if not settings.openai_api_key:
        return {
            "provider": "heuristic_fallback",
            "advisory": True,
            "confidence": 0.35,
            "observations": "OPENAI_API_KEY not configured. AI advisory skipped; use software result as primary.",
            "caveats": "Configure OPENAI_API_KEY for Vision LLM comparison.",
        }

    prompt = PROMPTS.get(analysis_type, PROMPTS[AnalysisType.grain_size])
    b64 = _encode_jpeg_b64(image_bgr)
    payload = {
        "model": settings.openai_model,
        "messages": [
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
        ],
        "response_format": {"type": "json_object"},
        "max_tokens": 800,
    }
    async with httpx.AsyncClient(timeout=90.0) as client:
        resp = await client.post(
            "https://api.openai.com/v1/chat/completions",
            headers={"Authorization": f"Bearer {settings.openai_api_key}"},
            json=payload,
        )
        resp.raise_for_status()
        data = resp.json()
    content = data["choices"][0]["message"]["content"]
    parsed = json.loads(content)
    parsed["provider"] = "openai"
    parsed["model"] = settings.openai_model
    parsed["advisory"] = True
    return parsed


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
