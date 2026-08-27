from __future__ import annotations

import io
from datetime import datetime
from typing import Any

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle


def build_analysis_pdf(
    org_name: str,
    sample_code: str,
    analysis_type: str,
    software_result: dict[str, Any] | None,
    ai_result: dict[str, Any] | None,
    comparison: dict[str, Any] | None,
) -> bytes:
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=A4, leftMargin=18 * mm, rightMargin=18 * mm)
    styles = getSampleStyleSheet()
    title = ParagraphStyle(
        "TitleLab",
        parent=styles["Heading1"],
        textColor=colors.HexColor("#1f2a30"),
        spaceAfter=8,
    )
    body = ParagraphStyle("BodyLab", parent=styles["Normal"], textColor=colors.HexColor("#2c3a42"), leading=14)

    story = [
        Paragraph(org_name, title),
        Paragraph("Metallurgy Analysis Report", styles["Heading2"]),
        Spacer(1, 6),
        Paragraph(f"<b>Sample:</b> {sample_code}", body),
        Paragraph(f"<b>Analysis:</b> {analysis_type}", body),
        Paragraph(f"<b>Generated:</b> {datetime.utcnow().strftime('%Y-%m-%d %H:%M UTC')}", body),
        Spacer(1, 12),
        Paragraph("<b>Software Analysis (Primary)</b>", styles["Heading3"]),
    ]

    soft_rows = [["Metric", "Value"]]
    for k, v in (software_result or {}).items():
        if isinstance(v, (str, int, float)):
            soft_rows.append([k, str(v)])
    soft_table = Table(soft_rows, colWidths=[80 * mm, 80 * mm])
    soft_table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#2f6f6a")),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                ("GRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#c5d0d4")),
                ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#f3f6f7")]),
            ]
        )
    )
    story.append(soft_table)
    story.append(Spacer(1, 12))
    story.append(Paragraph("<b>AI Advisory Analysis</b>", styles["Heading3"]))
    story.append(
        Paragraph(
            (ai_result or {}).get("observations", "AI analysis not available."),
            body,
        )
    )
    if comparison:
        story.append(Spacer(1, 8))
        story.append(Paragraph("<b>Comparison</b>", styles["Heading3"]))
        story.append(Paragraph(comparison.get("summary", ""), body))
    story.append(Spacer(1, 16))
    story.append(
        Paragraph(
            "<i>Disclaimer: Software analysis is the primary standards-oriented result. "
            "AI output is advisory only and requires qualified metallurgist review.</i>",
            body,
        )
    )
    doc.build(story)
    return buffer.getvalue()
