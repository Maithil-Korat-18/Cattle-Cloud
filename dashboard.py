from flask import render_template, request, jsonify, session, redirect, url_for, Blueprint, send_file, flash
from db import get_db
from datetime import date, timedelta, datetime
import io

# reportlab for PDF (pip install reportlab)
from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.units import inch
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_CENTER

dashboard_bp = Blueprint("dashboard_bp", __name__)


# ────────────────────────────────────────────────────────
# HELPER: time_ago  (sort key is a real datetime now)
# ────────────────────────────────────────────────────────
def get_time_ago(timestamp):
    if not timestamp:
        return "unknown"
    now  = datetime.now()
    diff = now - timestamp
    if diff.days > 0:
        return f"{diff.days}d ago"
    elif diff.seconds >= 3600:
        return f"{diff.seconds // 3600}h ago"
    elif diff.seconds >= 60:
        return f"{diff.seconds // 60}m ago"
    return "just now"


# ────────────────────────────────────────────────────────
# MAIN DASHBOARD
# ────────────────────────────────────────────────────────
@dashboard_bp.route('/dashboard')
def dashboard():
    user_id = session.get('user_id')
    if not user_id:
        return redirect(url_for('auth.login'))

    connection = get_db()
    if not connection:
        flash('Database connection error', 'danger')
        return redirect(url_for('auth.login'))

    cursor = connection.cursor(dictionary=True)
    today  = datetime.now().date()

    # ── Stats ──
    cursor.execute("SELECT COUNT(*) as count FROM cattle WHERE user_id = %s", (user_id,))
    total_cattle = cursor.fetchone()['count']

    cursor.execute("""
        SELECT COALESCE(SUM(milk_liters), 0) AS total
        FROM milk_records WHERE user_id = %s AND date = %s
    """, (user_id, today))
    milk_today = float(cursor.fetchone()['total'])

    current_month = datetime.now().month
    current_year  = datetime.now().year
    cursor.execute("""
        SELECT COALESCE(SUM(income), 0) AS total
        FROM milk_records WHERE user_id = %s AND MONTH(date) = %s AND YEAR(date) = %s
    """, (user_id, current_month, current_year))
    monthly_revenue = float(cursor.fetchone()['total'])

    # ── Weekly chart data ──
    weekly_milk_data = []
    for i in range(6, -1, -1):
        d = today - timedelta(days=i)
        cursor.execute("""
            SELECT COALESCE(SUM(milk_liters), 0) AS total
            FROM milk_records WHERE user_id = %s AND date = %s
        """, (user_id, d))
        weekly_milk_data.append({'day': d.strftime('%a'), 'value': float(cursor.fetchone()['total'])})

    # ── Recent Activity ── (all types: cattle, milk, health, feed/expense)
    raw_activities = []

    # Recent cattle additions
    cursor.execute("""
        SELECT id, name, tag_no, breed, created_at
        FROM cattle WHERE user_id = %s ORDER BY created_at DESC LIMIT 3
    """, (user_id,))
    for a in cursor.fetchall():
        raw_activities.append({
            'ts':          a['created_at'],
            'icon':        'pets',
            'color':       'indigo',
            'title':       'New cattle added',
            'description': f"{a['name']} · {a['breed']}{' (#' + a['tag_no'] + ')' if a['tag_no'] else ''}",
            'time':        get_time_ago(a['created_at']),
            'link':        f"/cattle/{a['id']}"
        })

    # Recent milk records
    cursor.execute("""
        SELECT mr.id, mr.milk_liters, mr.income, mr.created_at, c.name AS cattle_name, c.id AS cattle_id
        FROM milk_records mr JOIN cattle c ON mr.cattle_id = c.id
        WHERE mr.user_id = %s ORDER BY mr.created_at DESC LIMIT 4
    """, (user_id,))
    for a in cursor.fetchall():
        raw_activities.append({
            'ts':          a['created_at'],
            'icon':        'water_drop',
            'color':       'violet',
            'title':       'Milk record added',
            'description': f"{a['cattle_name']} · {float(a['milk_liters']):.1f} L · ₹{float(a['income']):.0f}",
            'time':        get_time_ago(a['created_at']),
            'link':        f"/cattle/{a['cattle_id']}"
        })

    # Recent health records
    cursor.execute("""
        SELECT hr.id, hr.issue, hr.vet_name, hr.created_at, c.name AS cattle_name, c.id AS cattle_id
        FROM health_records hr JOIN cattle c ON hr.cattle_id = c.id
        WHERE hr.user_id = %s ORDER BY hr.created_at DESC LIMIT 3
    """, (user_id,))
    for a in cursor.fetchall():
        raw_activities.append({
            'ts':          a['created_at'],
            'icon':        'medical_services',
            'color':       'red',
            'title':       'Health record added',
            'description': f"{a['cattle_name']} · {a['issue']} · Vet: {a['vet_name']}",
            'time':        get_time_ago(a['created_at']),
            'link':        f"/cattle/{a['cattle_id']}"
        })

    # Recent feed usage
    cursor.execute("""
        SELECT fu.id, fu.quantity_used, fu.created_at, fs.feed_name,
               c.name AS cattle_name, c.id AS cattle_id
        FROM feed_usage fu
        JOIN feed_stock fs ON fu.feed_id = fs.id
        LEFT JOIN cattle c ON fu.cattle_id = c.id
        WHERE fu.user_id = %s ORDER BY fu.created_at DESC LIMIT 3
    """, (user_id,))
    for a in cursor.fetchall():
        raw_activities.append({
            'ts':          a['created_at'],
            'icon':        'grass',
            'color':       'green',
            'title':       'Feed record added',
            'description': f"{a['cattle_name'] or 'General'} · {a['feed_name']} · {float(a['quantity_used']):.1f} kg",
            'time':        get_time_ago(a['created_at']),
            'link':        f"/cattle/{a['cattle_id']}" if a['cattle_id'] else '/feed'
        })

    # Recent expenses
    cursor.execute("""
        SELECT e.id, e.amount, e.category, e.description, e.created_at
        FROM expenses e WHERE e.user_id = %s ORDER BY e.created_at DESC LIMIT 3
    """, (user_id,))
    for a in cursor.fetchall():
        raw_activities.append({
            'ts':          a['created_at'],
            'icon':        'payments',
            'color':       'amber',
            'title':       f"Expense: {a['category'] or 'General'}",
            'description': f"₹{float(a['amount']):.0f}{' · ' + a['description'] if a['description'] else ''}",
            'time':        get_time_ago(a['created_at']),
            'link':        '/expenses'
        })

    # Sort by timestamp descending, take top 8
    raw_activities.sort(key=lambda x: x['ts'] if x['ts'] else datetime.min, reverse=True)
    recent_activities = raw_activities[:8]
    # Remove raw timestamp before passing to template
    for a in recent_activities:
        a.pop('ts', None)

    # ── SMART ALERTS (genuine only — no "all systems ok" filler) ──
    alerts = []

    # 1. Low feed stock
    cursor.execute("""
        SELECT id, feed_name, quantity, min_quantity
        FROM feed_stock WHERE user_id = %s AND quantity < min_quantity
    """, (user_id,))
    for stock in cursor.fetchall():
        pct = int(stock['quantity'] / stock['min_quantity'] * 100) if stock['min_quantity'] > 0 else 0
        alerts.append({
            'type':        'danger',
            'dot_color':   'danger',
            'title':       f"Low Feed Stock: {stock['feed_name']}",
            'description': f"Only {float(stock['quantity']):.1f} kg left ({pct}% of minimum)",
            'link':        '/feed'
        })

    # 2. Upcoming vet checkups (within 7 days)
    cursor.execute("""
        SELECT hr.next_checkup, hr.vet_name, c.name AS cattle_name, c.id AS cattle_id
        FROM health_records hr JOIN cattle c ON hr.cattle_id = c.id
        WHERE hr.user_id = %s AND hr.next_checkup >= %s AND hr.next_checkup <= %s
        ORDER BY hr.next_checkup ASC LIMIT 5
    """, (user_id, today, today + timedelta(days=7)))
    for appt in cursor.fetchall():
        days_left = (appt['next_checkup'] - today).days
        label     = "Today" if days_left == 0 else f"in {days_left}d"
        alerts.append({
            'type':        'warning',
            'dot_color':   'warning',
            'title':       f"Vet Checkup Due: {appt['cattle_name']}",
            'description': f"{appt['vet_name']} · Due {label} ({appt['next_checkup'].strftime('%b %d')})",
            'link':        f"/cattle/{appt['cattle_id']}"
        })

    # 3. Cattle with consistently low milk production (last 5 days below 50% of their own 30-day avg)
    cursor.execute("""
        SELECT id, name FROM cattle WHERE user_id = %s
    """, (user_id,))
    all_cattle = cursor.fetchall()

    for cattle in all_cattle:
        cid = cattle['id']
        # 30-day average
        cursor.execute("""
            SELECT COALESCE(AVG(milk_liters), 0) AS avg30
            FROM milk_records
            WHERE cattle_id = %s AND user_id = %s
              AND date >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
        """, (cid, user_id))
        avg30 = float(cursor.fetchone()['avg30'])
        if avg30 < 0.1:
            continue  # no data — skip

        # Count days in last 5 where yield < 50% of avg30
        cursor.execute("""
            SELECT COUNT(*) AS low_days
            FROM milk_records
            WHERE cattle_id = %s AND user_id = %s
              AND date >= DATE_SUB(CURDATE(), INTERVAL 5 DAY)
              AND milk_liters < %s
        """, (cid, user_id, avg30 * 0.5))
        low_days = cursor.fetchone()['low_days']

        if low_days >= 3:
            alerts.append({
                'type':        'warning',
                'dot_color':   'warning',
                'title':       f"Low Milk Yield: {cattle['name']}",
                'description': f"{low_days}/5 recent days below 50% of average ({avg30:.1f} L avg)",
                'link':        f"/cattle/{cid}"
            })

    # 4. Cattle consuming significantly less feed than average (last 5 days)
    cursor.execute("""
        SELECT cattle_id,
               AVG(qty_per_day) AS avg_feed
        FROM (
            SELECT cattle_id, usage_date, SUM(quantity_used) AS qty_per_day
            FROM feed_usage
            WHERE user_id = %s
              AND cattle_id IS NOT NULL
              AND usage_date >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
            GROUP BY cattle_id, usage_date
        ) daily
        GROUP BY cattle_id
    """, (user_id,))
    avg_feed_map = {r['cattle_id']: float(r['avg_feed']) for r in cursor.fetchall()}

    for cattle in all_cattle:
        cid     = cattle['id']
        avg_f   = avg_feed_map.get(cid, 0)
        if avg_f < 0.1:
            continue

        cursor.execute("""
            SELECT COUNT(*) AS low_days
            FROM (
                SELECT usage_date, SUM(quantity_used) AS total
                FROM feed_usage
                WHERE user_id = %s AND cattle_id = %s
                  AND usage_date >= DATE_SUB(CURDATE(), INTERVAL 5 DAY)
                GROUP BY usage_date
            ) daily
            WHERE total < %s
        """, (user_id, cid, avg_f * 0.5))
        low_days = cursor.fetchone()['low_days']

        if low_days >= 3:
            alerts.append({
                'type':        'warning',
                'dot_color':   'warning',
                'title':       f"Low Feed Intake: {cattle['name']}",
                'description': f"{low_days}/5 recent days below 50% of avg feed ({avg_f:.1f} kg avg)",
                'link':        f"/cattle/{cid}"
            })

    cursor.close()
    connection.close()

    cattle_change  = 2.4
    milk_change    = -1.2
    revenue_change = 5.8

    return render_template(
        'dashboard.html',
        user_name       = session.get('full_name', 'User').split()[0],
        total_cattle    = total_cattle,
        cattle_change   = cattle_change,
        milk_today      = milk_today,
        milk_change     = milk_change,
        monthly_revenue = monthly_revenue,
        revenue_change  = revenue_change,
        weekly_milk_data= weekly_milk_data,
        recent_activities = recent_activities,
        alerts          = alerts,          # only genuine alerts — empty list = no card shown
        now             = datetime.now()
    )


# ────────────────────────────────────────────────────────
# API: Cattle list for Quick Record modal dropdown
# ────────────────────────────────────────────────────────
@dashboard_bp.route('/api/cattle-list')
def api_cattle_list():
    user_id = session.get('user_id')
    if not user_id:
        return jsonify({'success': False, 'error': 'Not authenticated'}), 401

    conn = get_db()
    cur  = conn.cursor(dictionary=True)
    try:
        cur.execute("SELECT id, name, tag_no, breed FROM cattle WHERE user_id = %s ORDER BY name ASC", (user_id,))
        cattle = cur.fetchall()
        return jsonify({'success': True, 'cattle': cattle})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500
    finally:
        cur.close()
        conn.close()


# ────────────────────────────────────────────────────────
# OVERVIEW REPORT — PDF across all cattle
# ────────────────────────────────────────────────────────
@dashboard_bp.route('/dashboard/report')
def overview_report():
    user_id    = session.get('user_id')
    if not user_id:
        return redirect(url_for('auth.login'))

    start_date = request.args.get('start_date')
    end_date   = request.args.get('end_date')
    if not start_date or not end_date:
        return "Missing date range", 400

    conn = get_db()
    cur  = conn.cursor(dictionary=True)
    try:
        # All cattle
        cur.execute("SELECT * FROM cattle WHERE user_id = %s ORDER BY name", (user_id,))
        cattle_list = cur.fetchall()

        # Milk summary per cattle
        cur.execute("""
            SELECT c.name, c.tag_no,
                   COALESCE(SUM(mr.milk_liters),0) AS total_milk,
                   COALESCE(AVG(mr.milk_liters),0) AS avg_milk,
                   COALESCE(SUM(mr.income),0)      AS total_income,
                   COUNT(mr.id)                     AS records
            FROM cattle c
            LEFT JOIN milk_records mr ON c.id = mr.cattle_id
              AND mr.date BETWEEN %s AND %s
            WHERE c.user_id = %s
            GROUP BY c.id
            ORDER BY c.name
        """, (start_date, end_date, user_id))
        milk_summary = cur.fetchall()

        # Feed cost
        cur.execute("""
            SELECT COALESCE(SUM(fu.quantity_used * fs.cost_per_kg),0) AS total_feed_cost,
                   COALESCE(SUM(fu.quantity_used),0)                  AS total_feed_kg
            FROM feed_usage fu JOIN feed_stock fs ON fu.feed_id = fs.id
            WHERE fu.user_id = %s AND fu.usage_date BETWEEN %s AND %s
        """, (user_id, start_date, end_date))
        feed_row = cur.fetchone()

        # Overall totals
        total_milk   = sum(float(r['total_milk'])   for r in milk_summary)
        total_income = sum(float(r['total_income']) for r in milk_summary)
        total_feed_cost = float(feed_row['total_feed_cost'])
        total_feed_kg   = float(feed_row['total_feed_kg'])
        net_profit      = total_income - total_feed_cost

        # Health records count
        cur.execute("""
            SELECT COUNT(*) AS cnt FROM health_records
            WHERE user_id = %s AND DATE(created_at) BETWEEN %s AND %s
        """, (user_id, start_date, end_date))
        health_count = cur.fetchone()['cnt']

        # Build PDF
        buf  = io.BytesIO()
        doc  = SimpleDocTemplate(buf, pagesize=A4,
                                 topMargin=0.5*inch, bottomMargin=0.5*inch,
                                 leftMargin=0.75*inch, rightMargin=0.75*inch)
        styles = getSampleStyleSheet()

        title_s  = ParagraphStyle('T',  parent=styles['Heading1'],  fontSize=22,
                                   textColor=colors.HexColor('#667eea'),
                                   alignment=TA_CENTER, spaceAfter=4,
                                   fontName='Helvetica-Bold')
        sub_s    = ParagraphStyle('S',  parent=styles['Normal'],    fontSize=10,
                                   textColor=colors.HexColor('#6b7280'),
                                   alignment=TA_CENTER, spaceAfter=18)
        h2_s     = ParagraphStyle('H2', parent=styles['Heading2'],  fontSize=13,
                                   textColor=colors.HexColor('#1f2937'),
                                   spaceBefore=16, spaceAfter=8,
                                   fontName='Helvetica-Bold')
        norm_s   = ParagraphStyle('N',  parent=styles['Normal'],    fontSize=10,
                                   textColor=colors.HexColor('#374151'))

        def tbl(rows, widths, hdr_color='#667eea'):
            t = Table(rows, colWidths=widths)
            t.setStyle(TableStyle([
                ('BACKGROUND',    (0,0), (-1,0),  colors.HexColor(hdr_color)),
                ('TEXTCOLOR',     (0,0), (-1,0),  colors.white),
                ('FONTNAME',      (0,0), (-1,0),  'Helvetica-Bold'),
                ('FONTSIZE',      (0,0), (-1,-1), 9),
                ('BOTTOMPADDING', (0,0), (-1,0),  9),
                ('ALIGN',         (0,0), (-1,-1), 'LEFT'),
                ('FONTNAME',      (0,1), (-1,-1), 'Helvetica'),
                ('GRID',          (0,0), (-1,-1), 0.4, colors.HexColor('#e5e7eb')),
                ('ROWBACKGROUNDS',(0,1), (-1,-1), [colors.white, colors.HexColor('#f9fafb')]),
            ]))
            return t

        story = [
            Paragraph("Pashu Setu — Farm Overview Report", title_s),
            Paragraph(f"Period: {start_date}  to  {end_date}  ·  Generated {datetime.now().strftime('%b %d, %Y %I:%M %p')}", sub_s),
        ]

        # Summary table
        story.append(Paragraph("Financial Summary", h2_s))
        story.append(tbl([
            ['Metric', 'Value'],
            ['Total Milk Produced',   f"{total_milk:.1f} L"],
            ['Total Milk Income',     f"₹{total_income:,.0f}"],
            ['Total Feed Cost',       f"₹{total_feed_cost:,.0f}  ({total_feed_kg:.1f} kg)"],
            ['Net Profit / Loss',     f"{'₹' if net_profit>=0 else '−₹'}{abs(net_profit):,.0f}"],
            ['Health Records',        str(health_count)],
            ['Total Cattle',          str(len(cattle_list))],
        ], [3*inch, 3.5*inch]))

        # Per-cattle breakdown
        story.append(Paragraph("Per-Cattle Production Breakdown", h2_s))
        rows = [['Cattle', 'Tag', 'Total Milk (L)', 'Avg/Day (L)', 'Income (₹)', 'Records']]
        for r in milk_summary:
            rows.append([
                r['name'],
                r['tag_no'] or '—',
                f"{float(r['total_milk']):.1f}",
                f"{float(r['avg_milk']):.1f}",
                f"₹{float(r['total_income']):,.0f}",
                str(r['records'])
            ])
        story.append(tbl(rows, [1.6*inch, 0.7*inch, 1.1*inch, 1.1*inch, 1.1*inch, 0.7*inch], '#22c55e'))

        doc.build(story)
        buf.seek(0)
        return send_file(buf, as_attachment=True,
                         download_name=f"pashu_setu_report_{start_date}_to_{end_date}.pdf",
                         mimetype='application/pdf')
    except Exception as e:
        return f"Report error: {str(e)}", 500
    finally:
        cur.close()
        conn.close()