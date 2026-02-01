from flask import Blueprint, render_template, request, jsonify, session, redirect, url_for
from db import get_db
from datetime import date,datetime,timedelta
import plotly.express as px
import pandas as pd
import os
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import cm
from flask import send_file
from collections import defaultdict
from decimal import Decimal


cattle_bp = Blueprint("cattle_bp", __name__)

def login_required():
    return "user_id" in session

def generate_milk_chart(rows, cattle_id):
    if not rows:
        return None

    import pandas as pd
    import plotly.graph_objects as go
    import os
    from flask import url_for

    df = pd.DataFrame(rows)

    # 🔥 Merge duplicate dates
##    df = df.groupby("date", as_index=False)["quantity"].sum()

    # 🔥 Convert to datetime
    df["date"] = pd.to_datetime(df["date"], errors="coerce")
    df = df.sort_values("date")
    fig = go.Figure()

    # ✅ Smooth line chart
    fig.add_scatter(
        x=df["date"],
        y=df["quantity"],
        mode="lines+markers",
        line=dict(
            color="#4F46E5",   # Indigo
            width=3,
            shape="spline"
        ),
        marker=dict(
            size=6,
            color="#4F46E5",
            line=dict(width=2, color="white")
        ),
        hovertemplate="<b>%{y} Liters</b><br>%{x|%d %b}<extra></extra>"
    )

    fig.update_layout(
        height=380,
        margin=dict(l=40, r=40, t=50, b=40),
        title=dict(
            text="Milk Production Trend",
            x=0.02,
            font=dict(size=18, color="#111827")
        ),
        xaxis=dict(
            title="Date",
            tickformat="%d %b",
            showgrid=False,
            tickfont=dict(size=12)
        ),
        yaxis=dict(
            title="Liters",
            showgrid=True,
            gridcolor="rgba(0,0,0,0.08)",
            tickfont=dict(size=12)
        ),
        plot_bgcolor="white",
        paper_bgcolor="white",
        hovermode="x unified",
        font=dict(
            family="Inter, system-ui, sans-serif",
            color="#374151"
        )
    )

    os.makedirs("static/charts", exist_ok=True)
    file_path = f"static/charts/cattle_{cattle_id}.html"
    fig.write_html(file_path, include_plotlyjs="cdn")

    return url_for("static", filename=f"charts/cattle_{cattle_id}.html")



# ================= CATTLE DETAIL PAGE =================
@cattle_bp.route("/cattle/<int:cattle_id>")
def cattle_detail(cattle_id):
    if not login_required():
        return redirect(url_for("login_page"))

    user_id = session["user_id"]
    conn = get_db()
    cur = conn.cursor(dictionary=True)

    # ---- Get cattle info ----
    cur.execute("""
        SELECT id, name, breed, age, health
        FROM cattle
        WHERE id=%s AND user_id=%s
    """, (cattle_id, user_id))
    cattle = cur.fetchone()

    if not cattle:
        cur.close()
        conn.close()
        return redirect(url_for("dashboard"))

    # ---- Last 7 days milk ----
    cur.execute("""
        SELECT 
            date,
            SUM(milk_liters) AS quantity
        FROM milk_records
        WHERE cattle_id = %s
          AND date >= CURDATE() - INTERVAL 6 DAY
        GROUP BY date
        ORDER BY date ASC
    """, (cattle_id,))
    rows = cur.fetchall()
    for r in rows:
        if isinstance(r["date"], date):
            r["date"] = r["date"].strftime("%d %b")
   


    chart_path = generate_milk_chart(rows, cattle_id)


    avg_milk = round(
        sum(r["quantity"] for r in rows) / len(rows), 1
    ) if rows else 0

    cur.close()
    conn.close()

    return render_template(
        "cattle_detail.html",
        cattle=cattle,
        default_history=rows,
        avg_milk=avg_milk,
        chart_path=chart_path,
        username=session.get("full_name", "User")
    )


# ================= FILTER API =================
@cattle_bp.route("/api/cattle/<int:cattle_id>/filter", methods=["POST"])
def filter_cattle_data(cattle_id):
    if not login_required():
        return jsonify(success=False), 401

    user_id = session["user_id"]
    data = request.get_json()
    view_type = data.get("view_type")

    conn = get_db()
    cur = conn.cursor(dictionary=True)

    # Verify ownership
    cur.execute(
        "SELECT id FROM cattle WHERE id=%s AND user_id=%s",
        (cattle_id, user_id)
    )
    if not cur.fetchone():
        cur.close()
        conn.close()
        return jsonify(success=False), 403

    # Build query
    if view_type == "last_7":
        query = """
            SELECT date, milk_liters AS quantity
            FROM milk_records
            WHERE cattle_id=%s
             AND date >= CURDATE() - INTERVAL 6 DAY
            ORDER BY date
        """
        params = (cattle_id,)

    elif view_type == "all_time":
        query = """
            SELECT date, milk_liters AS quantity
            FROM milk_records
            WHERE cattle_id=%s
            ORDER BY date
        """
        params = (cattle_id,)

    elif view_type == "custom":
        query = """
            SELECT date, milk_liters AS quantity
            FROM milk_records
            WHERE cattle_id=%s AND date BETWEEN %s AND %s
            ORDER BY date
        """
        params = (cattle_id, data["start_date"], data["end_date"])

    else:
        cur.close()
        conn.close()
        return jsonify(success=False), 400

    cur.execute(query, params)
    raw_rows = cur.fetchall()

    # ✅ GROUP + SORT PROPERLY
    grouped = defaultdict(float)

    for r in raw_rows:
        qty = float(r["quantity"]) if isinstance(r["quantity"], Decimal) else float(r["quantity"])
        grouped[r["date"]] += qty

    rows = []
    for d in sorted(grouped.keys()):  # ✅ real date sorting
        rows.append({
            "date": d.strftime("%d %b"),
            "quantity": round(grouped[d], 2)
        })
        
    if rows:
        total_milk = sum(r["quantity"] for r in rows)
        avg_milk = round(total_milk / len(rows), 1)
        highest_day = max(rows, key=lambda x: x["quantity"])
    else:
        total_milk = avg_milk = 0
        highest_day = {"date": "-", "quantity": 0}

    cur.close()
    conn.close()
    chart_path = generate_milk_chart(rows, cattle_id)
    return jsonify(
        success=True,
        chart_url=chart_path,
        data={
            "history": rows,
            "total_milk": total_milk,
            "avg_milk": avg_milk,
            "highest_day": highest_day,
            "record_count": len(rows)
        }
    )
@cattle_bp.route("/api/cattle/<int:cattle_id>/edit", methods=["POST"])
def edit_cattle(cattle_id):
    if not login_required():
        return jsonify(success=False), 401

    data = request.get_json()
    user_id = session["user_id"]
    
    conn = get_db()
    cur = conn.cursor()
    
    try:
        cur.execute("""
            UPDATE cattle 
            SET name=%s, breed=%s, age=%s, health=%s
            WHERE id=%s AND user_id=%s
        """, (data['name'], data['breed'], data['age'], data['health'], cattle_id, user_id))
        conn.commit()
        success = True
    except Exception as e:
        print(f"Update error: {e}")
        success = False
    finally:
        cur.close()
        conn.close()
        
    return jsonify(success=success)

def calculate_trend(rows):
    if len(rows) < 4:
        return "Insufficient data for trend analysis."

    mid = len(rows) // 2
    first = rows[:mid]
    second = rows[mid:]

    first_avg = sum(float(r["quantity"]) for r in first) / len(first)
    second_avg = sum(float(r["quantity"]) for r in second) / len(second)

    if first_avg == 0:
        return "Insufficient data for trend analysis."

    diff = round(((second_avg - first_avg) / first_avg) * 100, 1)

    if diff > 5:
        return f"Positive trend: Production increased by {diff}%."
    elif diff < -5:
        return f"Declining trend: Production decreased by {abs(diff)}%."
    else:
        return f"Stable: Production remained consistent ({abs(diff)}% variation)."

from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import cm
from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT
from datetime import datetime
import os

def generate_cattle_pdf(cattle, rows, stats, trend_text):
    """Generate an attractive, fast-loading PDF report"""
    os.makedirs("static/reports", exist_ok=True)
    report_date = datetime.now().strftime("%Y-%m-%d")
    safe_name = cattle["name"].replace(" ", "_")
    filename = f"{safe_name}_Report_{report_date}.pdf"
    path = f"static/reports/{filename}"
    
    # Create document with metadata
    doc = SimpleDocTemplate(
        path, 
        pagesize=A4,
        rightMargin=2*cm,
        leftMargin=2*cm,
        topMargin=2*cm,
        bottomMargin=2*cm,
        title=f"{cattle['name']} Milk Report",
        author="CattleTrack Pro"
    )
    
    # Custom styles
    styles = getSampleStyleSheet()
    
    # Title style
    title_style = ParagraphStyle(
        'CustomTitle',
        parent=styles['Title'],
        fontSize=24,
        textColor=colors.HexColor('#1F2937'),
        spaceAfter=6,
        alignment=TA_CENTER,
        fontName='Helvetica-Bold'
    )
    
    # Subtitle style
    subtitle_style = ParagraphStyle(
        'Subtitle',
        parent=styles['Heading2'],
        fontSize=16,
        textColor=colors.HexColor('#4B5563'),
        spaceAfter=20,
        alignment=TA_CENTER,
        fontName='Helvetica'
    )
    
    # Section header style
    section_style = ParagraphStyle(
        'SectionHeader',
        parent=styles['Heading3'],
        fontSize=14,
        textColor=colors.HexColor('#1F2937'),
        spaceAfter=8,
        spaceBefore=12,
        fontName='Helvetica-Bold',
        textTransform='uppercase'
    )
    
    # Info style
    info_style = ParagraphStyle(
        'InfoStyle',
        parent=styles['Normal'],
        fontSize=11,
        textColor=colors.HexColor('#374151'),
        spaceAfter=4,
        fontName='Helvetica'
    )
    
    # Date style
    date_style = ParagraphStyle(
        'DateStyle',
        parent=styles['Normal'],
        fontSize=10,
        textColor=colors.HexColor('#6B7280'),
        alignment=TA_CENTER,
        spaceAfter=10
    )
    
    story = []
    
    # ========== HEADER ==========
    story.append(Paragraph("CATTLE TRACK PRO", title_style))
    story.append(Paragraph("Milk Production Report", subtitle_style))
    story.append(Paragraph(
        f"Generated: {datetime.now().strftime('%B %d, %Y at %I:%M %p')}", 
        date_style
    ))
    
    # Divider line
    story.append(Spacer(1, 0.3*cm))
    story.append(Table(
        [['']], 
        colWidths=[17*cm], 
        style=TableStyle([
            ('LINEABOVE', (0,0), (-1,-1), 2, colors.HexColor('#E5E7EB'))
        ])
    ))
    story.append(Spacer(1, 0.5*cm))
    
    # ========== CATTLE INFORMATION CARD ==========
    story.append(Paragraph("Cattle Information", section_style))
    
    cattle_data = [
        ["Name:", cattle['name']],
        ["Breed:", cattle['breed']],
        ["Age:", f"{cattle['age']} years"],
        ["Health Status:", cattle['health']]
    ]
    
    cattle_table = Table(cattle_data, colWidths=[4*cm, 13*cm])
    cattle_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (0, -1), colors.HexColor('#F3F4F6')),
        ('TEXTCOLOR', (0, 0), (-1, -1), colors.HexColor('#1F2937')),
        ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
        ('FONTNAME', (1, 0), (1, -1), 'Helvetica'),
        ('FONTSIZE', (0, 0), (-1, -1), 11),
        ('ALIGN', (0, 0), (0, -1), 'LEFT'),
        ('ALIGN', (1, 0), (1, -1), 'LEFT'),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#E5E7EB')),
        ('ROWBACKGROUNDS', (0, 0), (-1, -1), [colors.white, colors.HexColor('#F9FAFB')]),
        ('LEFTPADDING', (0, 0), (-1, -1), 12),
        ('RIGHTPADDING', (0, 0), (-1, -1), 12),
        ('TOPPADDING', (0, 0), (-1, -1), 8),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
    ]))
    story.append(cattle_table)
    story.append(Spacer(1, 0.7*cm))
    
    # ========== PERFORMANCE SUMMARY ==========
    story.append(Paragraph("Performance Summary", section_style))
    
    # Determine trend emoji and color
    if "Positive" in trend_text or "increased" in trend_text:
        trend_emoji = "📈"
        trend_color = colors.HexColor('#10B981')
    elif "Declining" in trend_text or "decreased" in trend_text:
        trend_emoji = "📉"
        trend_color = colors.HexColor('#EF4444')
    else:
        trend_emoji = "📊"
        trend_color = colors.HexColor('#6366F1')
    
    summary_data = [
        ["Total Production", f"{stats['total']} Liters", "🥛"],
        ["Daily Average", f"{stats['avg']} Liters", "📅"],
        ["Peak Production", f"{stats['highest']['quantity']} L on {stats['highest']['date']}", "⭐"],
        ["Trend", trend_text, trend_emoji]
    ]
    
    summary_table = Table(summary_data, colWidths=[4.5*cm, 11*cm, 1.5*cm])
    summary_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#EFF6FF')),
        ('TEXTCOLOR', (0, 0), (-1, -1), colors.HexColor('#1F2937')),
        ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
        ('FONTNAME', (1, 0), (1, -1), 'Helvetica'),
        ('FONTNAME', (2, 0), (2, -1), 'Helvetica'),
        ('FONTSIZE', (0, 0), (-1, -1), 11),
        ('ALIGN', (0, 0), (0, -1), 'LEFT'),
        ('ALIGN', (1, 0), (1, -1), 'LEFT'),
        ('ALIGN', (2, 0), (2, -1), 'CENTER'),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#DBEAFE')),
        ('LEFTPADDING', (0, 0), (-1, -1), 12),
        ('RIGHTPADDING', (0, 0), (-1, -1), 12),
        ('TOPPADDING', (0, 0), (-1, -1), 10),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 10),
        # Highlight trend row
        ('BACKGROUND', (0, 3), (-1, 3), trend_color),
        ('TEXTCOLOR', (0, 3), (-1, 3), colors.white),
    ]))
    story.append(summary_table)
    story.append(Spacer(1, 0.7*cm))
    
    # ========== PRODUCTION RECORDS ==========
    story.append(Paragraph("Detailed Production Records", section_style))
    
    # Optimize: Only show data if reasonable amount
    if len(rows) > 100:
        story.append(Paragraph(
            f"<i>Note: Showing summary for {len(rows)} records to optimize report size.</i>",
            info_style
        ))
        # Group by week or month for large datasets
        story.append(Spacer(1, 0.3*cm))
    
    # Table header
    table_data = [["Date", "Production (Liters)"]]
    
    # Limit rows for performance (show first 50 and last 50 if more than 100)
    if len(rows) <= 100:
        display_rows = rows
    else:
        display_rows = rows[:50] + [{"date": "...", "quantity": "..."}] + rows[-50:]
    
    for r in display_rows:
        table_data.append([str(r["date"]), str(r["quantity"])])
    
    production_table = Table(table_data, colWidths=[8.5*cm, 8.5*cm])
    production_table.setStyle(TableStyle([
        # Header styling
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#4F46E5')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, 0), 12),
        ('ALIGN', (0, 0), (-1, 0), 'CENTER'),
        
        # Data styling
        ('FONTNAME', (0, 1), (-1, -1), 'Helvetica'),
        ('FONTSIZE', (0, 1), (-1, -1), 10),
        ('ALIGN', (0, 1), (0, -1), 'LEFT'),
        ('ALIGN', (1, 1), (1, -1), 'RIGHT'),
        ('TEXTCOLOR', (0, 1), (-1, -1), colors.HexColor('#374151')),
        
        # Grid and padding
        ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#E5E7EB')),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#F9FAFB')]),
        ('LEFTPADDING', (0, 0), (-1, -1), 12),
        ('RIGHTPADDING', (0, 0), (-1, -1), 12),
        ('TOPPADDING', (0, 0), (-1, -1), 8),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
    ]))
    story.append(production_table)
    story.append(Spacer(1, 1*cm))
    
    # ========== FOOTER ==========
    story.append(Table(
        [['']], 
        colWidths=[17*cm], 
        style=TableStyle([
            ('LINEABOVE', (0,0), (-1,-1), 1, colors.HexColor('#E5E7EB'))
        ])
    ))
    story.append(Spacer(1, 0.3*cm))
    
    footer_style = ParagraphStyle(
        'Footer',
        parent=styles['Normal'],
        fontSize=9,
        textColor=colors.HexColor('#6B7280'),
        alignment=TA_CENTER
    )
    
    story.append(Paragraph(
        "📧 info@cattletrack.com | 📞 +1 (555) 123-4567 | 🌐 www.cattletrack.com",
        footer_style
    ))
    story.append(Paragraph(
        f"Report ID: {cattle['id']}-{report_date} | © {datetime.now().year} CattleTrack Pro",
        footer_style
    ))
    
    # Build PDF (this is fast)
    doc.build(story)
    
    return path


# --------------------------------------------------
# REPORT DOWNLOAD (FILTER AWARE)
# --------------------------------------------------
@cattle_bp.route("/cattle/<int:cattle_id>/report")
def download_cattle_report(cattle_id):
    if "user_id" not in session:
        return redirect(url_for("login_page"))

    user_id = session["user_id"]
    view_type = request.args.get("view_type")
    start_date = request.args.get("start_date")
    end_date = request.args.get("end_date")

    conn = get_db()
    cur = conn.cursor(dictionary=True)

    # cattle info
    cur.execute("""
        SELECT id, name, breed, age, health
        FROM cattle
        WHERE id=%s AND user_id=%s
    """, (cattle_id, user_id))
    cattle = cur.fetchone()

    # query by selection
    if view_type == "last_7":
        query = """
            SELECT date, milk_liters AS quantity
            FROM milk_records
            WHERE cattle_id=%s
             AND date >= CURDATE() - INTERVAL 6 DAY
            ORDER BY date
        """
        params = (cattle_id,)
    elif view_type == "custom":
        query = """
            SELECT date, milk_liters AS quantity
            FROM milk_records
            WHERE cattle_id=%s AND date BETWEEN %s AND %s
            ORDER BY date
        """
        params = (cattle_id, start_date, end_date)
    else:
        query = """
            SELECT date, milk_liters AS quantity
            FROM milk_records
            WHERE cattle_id=%s
            ORDER BY date
        """
        params = (cattle_id,)

    cur.execute(query, params)
    raw_rows = cur.fetchall()

    # group by date + fix Decimal
    grouped = defaultdict(float)
    for r in raw_rows:
        qty = float(r["quantity"]) if isinstance(r["quantity"], Decimal) else r["quantity"]
        grouped[r["date"]] += qty

    rows = []
    for d, q in grouped.items():
        rows.append({
            "date": d.strftime("%d %b %Y") if isinstance(d, date) else d,
            "quantity": round(q, 2)
        })
    rows.sort(key=lambda x: datetime.strptime(x["date"], "%d %b %Y"))

    total = sum(float(r["quantity"]) for r in rows)
    avg = round(total / len(rows), 1) if rows else 0
    highest = max(rows, key=lambda x: x["quantity"]) if rows else {"date": "-", "quantity": 0}
    trend_text = calculate_trend(rows)

    cur.close()
    conn.close()

    pdf_path = generate_cattle_pdf(
        cattle,
        rows,
        {"total": total, "avg": avg, "highest": highest},
        trend_text
    )

    return send_file(
        pdf_path,
        as_attachment=True,
        download_name=os.path.basename(pdf_path)
    )
