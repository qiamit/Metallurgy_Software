"""ISO 643 oriented grain size analysis using classical CV."""

from __future__ import annotations

import math
from typing import Any

import cv2
import numpy as np


def _g_from_mean_intercept(mean_intercept_mm: float) -> float:
    """ASTM/ISO relationship: G = -6.6457 * log10(L) - 3.298 where L in mm."""
    if mean_intercept_mm <= 0:
        return 0.0
    return float(-6.6457 * math.log10(mean_intercept_mm) - 3.298)


def analyze_grain_size(
    image_bgr: np.ndarray,
    um_per_px_x: float = 1.0,
    um_per_px_y: float = 1.0,
    method: str = "intercept",
) -> tuple[dict[str, Any], np.ndarray]:
    gray = cv2.cvtColor(image_bgr, cv2.COLOR_BGR2GRAY)
    blurred = cv2.GaussianBlur(gray, (5, 5), 0)
    # Enhance boundaries
    clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
    enhanced = clahe.apply(blurred)
    edges = cv2.Canny(enhanced, 40, 120)
    kernel = np.ones((3, 3), np.uint8)
    boundaries = cv2.dilate(edges, kernel, iterations=1)

    h, w = gray.shape
    overlay = image_bgr.copy()
    um_per_px = (um_per_px_x + um_per_px_y) / 2.0

    intercepts: list[float] = []
    # Horizontal test lines
    for y in np.linspace(int(h * 0.15), int(h * 0.85), 7, dtype=int):
        row = boundaries[y, :]
        crossings = np.where((row[1:] > 0) & (row[:-1] == 0))[0]
        cv2.line(overlay, (0, int(y)), (w - 1, int(y)), (0, 200, 255), 1)
        if len(crossings) >= 2:
            for i in range(len(crossings) - 1):
                dx = crossings[i + 1] - crossings[i]
                intercepts.append(dx * um_per_px)
                cv2.circle(overlay, (int(crossings[i]), int(y)), 2, (0, 255, 0), -1)

    # Vertical test lines
    for x in np.linspace(int(w * 0.15), int(w * 0.85), 7, dtype=int):
        col = boundaries[:, x]
        crossings = np.where((col[1:] > 0) & (col[:-1] == 0))[0]
        cv2.line(overlay, (int(x), 0), (int(x), h - 1), (255, 180, 0), 1)
        if len(crossings) >= 2:
            for i in range(len(crossings) - 1):
                dy = crossings[i + 1] - crossings[i]
                intercepts.append(dy * um_per_px)
                cv2.circle(overlay, (int(x), int(crossings[i])), 2, (0, 255, 0), -1)

    mean_um = float(np.mean(intercepts)) if intercepts else 0.0
    mean_mm = mean_um / 1000.0
    g_value = _g_from_mean_intercept(mean_mm) if mean_mm > 0 else 0.0

    # Planimetric grain count estimate via connected components on inverted boundaries
    closed = cv2.morphologyEx(boundaries, cv2.MORPH_CLOSE, kernel, iterations=2)
    inv = cv2.bitwise_not(closed)
    num_labels, _ = cv2.connectedComponents(inv)
    grain_count = max(num_labels - 1, 0)
    area_mm2 = (w * um_per_px_x / 1000.0) * (h * um_per_px_y / 1000.0)
    na = grain_count / area_mm2 if area_mm2 > 0 else 0.0
    g_planimetric = float(math.log2(na) + 1) if na > 0 else 0.0

    result = {
        "standard": "ISO 643:2019",
        "method": method,
        "mean_intercept_um": round(mean_um, 3),
        "mean_intercept_mm": round(mean_mm, 6),
        "grain_size_number_G": round(g_value, 2),
        "grain_count_estimate": grain_count,
        "na_per_mm2": round(na, 3),
        "grain_size_number_G_planimetric": round(g_planimetric, 2),
        "intercept_count": len(intercepts),
        "um_per_px_x": um_per_px_x,
        "um_per_px_y": um_per_px_y,
        "image_width_px": w,
        "image_height_px": h,
        "notes": "Deterministic CV estimate. Validate on etched specimens with reviewer.",
    }
    return result, overlay
