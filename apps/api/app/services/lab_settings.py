"""Organization laboratory profile (stored in Organization.branding['lab'])."""

from __future__ import annotations

from typing import Any

LAB_TEXT_FIELDS = (
    "company_name",
    "gst_number",
    "contact_person_name",
    "mobile_number",
    "email_id",
    "address",
    "pin_code",
    "city",
    "state",
    "country",
)

LAB_ASSET_FIELDS = (
    "company_logo_key",
    "company_header_key",
    "company_footer_key",
    "watermark_key",
)


def read_lab_settings(branding: dict[str, Any] | None, org_name: str | None = None) -> dict[str, Any]:
    lab = dict((branding or {}).get("lab") or {})
    data: dict[str, Any] = {
        "company_name": str(lab.get("company_name") or org_name or ""),
    }
    for key in LAB_TEXT_FIELDS[1:]:
        data[key] = str(lab.get(key) or "")
    for key in LAB_ASSET_FIELDS:
        val = lab.get(key)
        data[key] = val if isinstance(val, str) and val.strip() else None
    return data


def merge_lab_settings(branding: dict[str, Any] | None, payload: dict[str, Any]) -> dict[str, Any]:
    merged = dict(branding or {})
    current = dict(merged.get("lab") or {})
    for key in LAB_TEXT_FIELDS:
        if key in payload:
            current[key] = payload[key] or ""
    merged["lab"] = current
    return merged


def set_lab_asset(branding: dict[str, Any] | None, asset: str, storage_key: str) -> dict[str, Any]:
    field_map = {
        "logo": "company_logo_key",
        "header": "company_header_key",
        "footer": "company_footer_key",
        "watermark": "watermark_key",
    }
    target = field_map.get(asset)
    if not target:
        raise ValueError("Invalid asset type")
    merged = dict(branding or {})
    current = dict(merged.get("lab") or {})
    current[target] = storage_key
    merged["lab"] = current
    return merged
