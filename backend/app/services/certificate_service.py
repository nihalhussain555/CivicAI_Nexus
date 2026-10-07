"""
Generates a branded, printable PDF certificate — used for both citizen
civic-reward tiers (rewards.py) and officer performance badges
(officers.py). One generator, two callers, so the design stays
consistent across the whole rewards/recognition system.
"""

import io
from datetime import datetime

from reportlab.lib.pagesizes import landscape, A4
from reportlab.lib.colors import HexColor
from reportlab.lib.units import mm
from reportlab.pdfgen import canvas

ACCENT = HexColor("#7C3AED")
INK = HexColor("#1f2430")
MUTED = HexColor("#6b7280")


def generate_certificate_pdf(
    recipient_name: str,
    headline: str,
    subtitle: str,
    achievement_label: str,
    cert_id: str,
) -> bytes:
    buffer = io.BytesIO()
    page_size = landscape(A4)
    width, height = page_size
    c = canvas.Canvas(buffer, pagesize=page_size)

    margin = 14 * mm
    c.setStrokeColor(ACCENT)
    c.setLineWidth(3)
    c.rect(margin, margin, width - 2 * margin, height - 2 * margin)
    c.setLineWidth(0.75)
    c.rect(margin + 5 * mm, margin + 5 * mm, width - 2 * (margin + 5 * mm), height - 2 * (margin + 5 * mm))

    center_x = width / 2

    c.setFillColor(ACCENT)
    c.setFont("Helvetica-Bold", 14)
    c.drawCentredString(center_x, height - 32 * mm, "CIVICAI NEXUS")

    c.setFillColor(MUTED)
    c.setFont("Helvetica", 10)
    c.drawCentredString(center_x, height - 38 * mm, "Civic Grievance Intelligence Platform")

    c.setFillColor(INK)
    c.setFont("Helvetica-Bold", 28)
    c.drawCentredString(center_x, height - 58 * mm, headline)

    c.setFillColor(MUTED)
    c.setFont("Helvetica", 12)
    c.drawCentredString(center_x, height - 67 * mm, subtitle)

    c.setFillColor(ACCENT)
    c.setFont("Helvetica-Bold", 34)
    c.drawCentredString(center_x, height - 90 * mm, recipient_name)

    c.setStrokeColor(ACCENT)
    c.setLineWidth(1)
    c.line(center_x - 70 * mm, height - 95 * mm, center_x + 70 * mm, height - 95 * mm)

    c.setFillColor(INK)
    c.setFont("Helvetica", 13)
    c.drawCentredString(center_x, height - 108 * mm, achievement_label)

    footer_y = margin + 18 * mm
    c.setFillColor(MUTED)
    c.setFont("Helvetica", 9)
    c.drawString(margin + 12 * mm, footer_y, f"Issued {datetime.utcnow():%d %B %Y}")
    c.drawRightString(width - margin - 12 * mm, footer_y, f"Certificate ID: {cert_id}")

    c.setStrokeColor(MUTED)
    c.setLineWidth(0.5)
    c.line(center_x - 35 * mm, footer_y + 10 * mm, center_x + 35 * mm, footer_y + 10 * mm)
    c.setFont("Helvetica-Oblique", 9)
    c.drawCentredString(center_x, footer_y + 3 * mm, "CivicAI Nexus — Verified Digital Certificate")

    c.showPage()
    c.save()
    buffer.seek(0)
    return buffer.read()