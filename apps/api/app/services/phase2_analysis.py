"""Phase-2 analysis modules: inclusion, decarb, micro, macro."""

from __future__ import annotations

from typing import Any

import cv2
import numpy as np


def analyze_inclusion(
    image_bgr: np.ndarray,
    um_per_px_x: float = 1.0,
    um_per_px_y: float = 1.0,
) -> tuple[dict[str, Any], np.ndarray]:
    """ISO 4967 oriented inclusion detection via dark-particle segmentation."""
    gray = cv2.cvtColor(image_bgr, cv2.COLOR_BGR2GRAY)
    blur = cv2.GaussianBlur(gray, (5, 5), 0)
    _, thresh = cv2.threshold(blur, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)
    kernel = np.ones((3, 3), np.uint8)
    clean = cv2.morphologyEx(thresh, cv2.MORPH_OPEN, kernel, iterations=1)
    contours, _ = cv2.findContours(clean, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

    overlay = image_bgr.copy()
    um_per_px = (um_per_px_x + um_per_px_y) / 2.0
    particles: list[dict[str, float]] = []
    type_counts = {"A": 0, "B": 0, "C": 0, "D": 0, "DS": 0}

    for cnt in contours:
        area = cv2.contourArea(cnt)
        if area < 8:
            continue
        x, y, w, h = cv2.boundingRect(cnt)
        length_um = max(w, h) * um_per_px
        width_um = min(w, h) * um_per_px
        aspect = length_um / max(width_um, 1e-6)
        if aspect > 5 and length_um > 20:
            itype = "A"  # sulfide-like stringer heuristic
        elif aspect > 3:
            itype = "B"
        elif aspect > 2:
            itype = "C"
        elif length_um > 50:
            itype = "DS"
        else:
            itype = "D"
        type_counts[itype] += 1
        severity = min(5, int(length_um // 25) + 1)
        particles.append(
            {
                "type": itype,
                "length_um": round(length_um, 2),
                "width_um": round(width_um, 2),
                "area_px": float(area),
                "severity_index": severity,
            }
        )
        color = {
            "A": (0, 0, 255),
            "B": (0, 165, 255),
            "C": (0, 255, 255),
            "D": (0, 255, 0),
            "DS": (255, 0, 255),
        }[itype]
        cv2.rectangle(overlay, (x, y), (x + w, y + h), color, 1)
        cv2.putText(overlay, itype, (x, max(12, y - 2)), cv2.FONT_HERSHEY_SIMPLEX, 0.4, color, 1)

    worst = max((p["severity_index"] for p in particles), default=0)
    result = {
        "standard": "ISO 4967:1998",
        "inclusion_count": len(particles),
        "type_counts": type_counts,
        "worst_severity_index": worst,
        "particles": particles[:200],
        "notes": "Heuristic classification vs chart types A/B/C/D/DS. Reviewer confirmation required.",
    }
    return result, overlay


def analyze_decarb(
    image_bgr: np.ndarray,
    um_per_px_x: float = 1.0,
    um_per_px_y: float = 1.0,
) -> tuple[dict[str, Any], np.ndarray]:
    """ISO 3887 oriented decarburization depth from edge transition."""
    gray = cv2.cvtColor(image_bgr, cv2.COLOR_BGR2GRAY)
    h, w = gray.shape
    # Assume left edge is free surface; measure transition of mean intensity profile
    profile = np.mean(gray, axis=0).astype(np.float32)
    smooth = cv2.GaussianBlur(profile.reshape(1, -1), (1, 31), 0).ravel()
    grad = np.abs(np.gradient(smooth))
    # Search transition in outer 40% of width
    search = grad[: max(10, int(w * 0.4))]
    edge_idx = int(np.argmax(search))
    depth_um = edge_idx * um_per_px_x

    overlay = image_bgr.copy()
    cv2.line(overlay, (edge_idx, 0), (edge_idx, h - 1), (0, 0, 255), 2)
    cv2.line(overlay, (0, 0), (0, h - 1), (0, 255, 0), 2)
    cv2.putText(
        overlay,
        f"Decarb depth ~ {depth_um:.1f} um",
        (10, 24),
        cv2.FONT_HERSHEY_SIMPLEX,
        0.7,
        (0, 0, 255),
        2,
    )

    result = {
        "standard": "ISO 3887:2017",
        "method": "metallographic_edge_transition",
        "decarb_depth_um": round(float(depth_um), 2),
        "decarb_depth_mm": round(float(depth_um) / 1000.0, 5),
        "edge_pixel": edge_idx,
        "notes": "Assumes free surface on image left. Reorient sample if needed.",
    }
    return result, overlay


def analyze_micro(
    image_bgr: np.ndarray,
    um_per_px_x: float = 1.0,
    um_per_px_y: float = 1.0,
) -> tuple[dict[str, Any], np.ndarray]:
    """Microstructure field stats: phase area fractions via Otsu multi-threshold."""
    gray = cv2.cvtColor(image_bgr, cv2.COLOR_BGR2GRAY)
    blur = cv2.GaussianBlur(gray, (5, 5), 0)
    _, binary = cv2.threshold(blur, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
    light_frac = float(np.mean(binary == 255))
    dark_frac = 1.0 - light_frac
    overlay = image_bgr.copy()
    mask = np.zeros_like(image_bgr)
    mask[:, :, 1] = binary
    overlay = cv2.addWeighted(overlay, 0.7, mask, 0.3, 0)
    area_um2 = gray.shape[0] * gray.shape[1] * um_per_px_x * um_per_px_y
    result = {
        "standard": "Micro Analysis",
        "light_phase_fraction": round(light_frac, 4),
        "dark_phase_fraction": round(dark_frac, 4),
        "field_area_um2": round(float(area_um2), 2),
        "notes": "Binary phase split via Otsu. Extend with trained classifiers as needed.",
    }
    return result, overlay


def analyze_macro(
    image_bgr: np.ndarray,
    um_per_px_x: float = 1.0,
    um_per_px_y: float = 1.0,
) -> tuple[dict[str, Any], np.ndarray]:
    """IS 10138 oriented macroscopic inclusion/stringer detection (>=1mm)."""
    gray = cv2.cvtColor(image_bgr, cv2.COLOR_BGR2GRAY)
    blur = cv2.GaussianBlur(gray, (7, 7), 0)
    _, thresh = cv2.threshold(blur, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)
    contours, _ = cv2.findContours(thresh, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    overlay = image_bgr.copy()
    um_per_px = (um_per_px_x + um_per_px_y) / 2.0
    stringers = []
    for cnt in contours:
        x, y, w, h = cv2.boundingRect(cnt)
        length_mm = max(w, h) * um_per_px / 1000.0
        if length_mm < 1.0:
            continue
        thickness_mm = min(w, h) * um_per_px / 1000.0
        stringers.append(
            {
                "length_mm": round(length_mm, 3),
                "thickness_mm": round(thickness_mm, 3),
            }
        )
        cv2.rectangle(overlay, (x, y), (x + w, y + h), (255, 0, 0), 2)

    result = {
        "standard": "IS 10138:2010",
        "stringer_count": len(stringers),
        "total_length_mm": round(sum(s["length_mm"] for s in stringers), 3),
        "stringers": stringers[:200],
        "notes": "Macroscopic inclusions >= 1 mm length. Units depend on calibration (use mm scale for macro).",
    }
    return result, overlay
