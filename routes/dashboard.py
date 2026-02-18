from flask import render_template, request, jsonify, session, redirect, url_for, Blueprint, flash
from db import get_db
from datetime import date, timedelta, datetime

dashboard_bp = Blueprint("dashboard_bp", __name__)


# ─── helper ──────────────────────────────────────────────────────
def get_time_ago(timestamp):
    if not timestamp:
        return "unknown"
    diff = datetime.now() - timestamp
    if diff.days > 0:   return f"{diff.days}d ago"
    if diff.seconds >= 3600: return f"{diff.seconds // 3600}h ago"
    if diff.seconds >= 60:   return f"{diff.seconds // 60}m ago"
    return "just now"


# ─── MAIN DASHBOARD ──────────────────────────────────────────────
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

    # ── Basic stats ──
    cursor.execute("SELECT COUNT(*) AS count FROM cattle WHERE user_id=%s", (user_id,))
    total_cattle = cursor.fetchone()['count']

    cursor.execute("""
        SELECT COALESCE(SUM(milk_liters),0) AS total
        FROM milk_records WHERE user_id=%s AND date=%s
    """, (user_id, today))
    milk_today = float(cursor.fetchone()['total'])

    cm, cy = datetime.now().month, datetime.now().year
    cursor.execute("""
        SELECT COALESCE(SUM(income),0) AS total
        FROM milk_records WHERE user_id=%s AND MONTH(date)=%s AND YEAR(date)=%s
    """, (user_id, cm, cy))
    monthly_revenue = float(cursor.fetchone()['total'])

    # ── WEEKLY chart data (last 7 days) ──
    weekly_milk_data = []
    for i in range(6, -1, -1):
        d = today - timedelta(days=i)
        cursor.execute("""
            SELECT COALESCE(SUM(milk_liters),0) AS total
            FROM milk_records WHERE user_id=%s AND date=%s
        """, (user_id, d))
        weekly_milk_data.append({
            'label': d.strftime('%b %d'),
            'value': float(cursor.fetchone()['total'])
        })

    # ── MONTHLY chart data (each month of current year) ──
    monthly_milk_data = []
    months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
    for m in range(1, 13):
        cursor.execute("""
            SELECT COALESCE(SUM(milk_liters),0) AS total
            FROM milk_records WHERE user_id=%s AND MONTH(date)=%s AND YEAR(date)=%s
        """, (user_id, m, cy))
        monthly_milk_data.append({
            'label': months[m - 1],
            'value': float(cursor.fetchone()['total'])
        })

    # ── RECENT ACTIVITY — last 5 across all types ──
    raw = []

    cursor.execute("""
        SELECT id, name, tag_no, breed, created_at
        FROM cattle WHERE user_id=%s ORDER BY created_at DESC LIMIT 3
    """, (user_id,))
    for a in cursor.fetchall():
        raw.append({
            'ts': a['created_at'],
            'icon': 'pets', 'color': 'indigo',
            'title': 'New cattle added',
            'description': f"{a['name']} · {a['breed']}{(' (#' + a['tag_no'] + ')') if a['tag_no'] else ''}",
            'time': get_time_ago(a['created_at']),
            'link': f"/cattle/{a['id']}"
        })

    cursor.execute("""
        SELECT mr.milk_liters, mr.income, mr.created_at, c.name AS cn, c.id AS cid
        FROM milk_records mr JOIN cattle c ON mr.cattle_id=c.id
        WHERE mr.user_id=%s ORDER BY mr.created_at DESC LIMIT 4
    """, (user_id,))
    for a in cursor.fetchall():
        raw.append({
            'ts': a['created_at'],
            'icon': 'water_drop', 'color': 'violet',
            'title': 'Milk production recorded',
            'description': f"{a['cn']} produced {float(a['milk_liters']):.1f} L generating ₹{float(a['income']):.0f} revenue",
            'time': get_time_ago(a['created_at']),
            'link': f"/cattle/{a['cid']}"
        })

    cursor.execute("""
        SELECT hr.issue, hr.vet_name, hr.treatment_cost, hr.created_at, c.name AS cn, c.id AS cid
        FROM health_records hr JOIN cattle c ON hr.cattle_id=c.id
        WHERE hr.user_id=%s ORDER BY hr.created_at DESC LIMIT 3
    """, (user_id,))
    for a in cursor.fetchall():
        raw.append({
            'ts': a['created_at'],
            'icon': 'medical_services', 'color': 'red',
            'title': 'Health record added',
            'description': f"{a['cn']} · {a['issue']}{(' · ₹' + str(int(float(a['treatment_cost'])))) if a.get('treatment_cost') and float(a['treatment_cost']) > 0 else ''}",
            'time': get_time_ago(a['created_at']),
            'link': f"/cattle/{a['cid']}"
        })

    cursor.execute("""
        SELECT fu.quantity_used, fu.created_at, fs.feed_name,
               c.name AS cn, c.id AS cid
        FROM feed_usage fu
        JOIN feed_stock fs ON fu.feed_id=fs.id
        LEFT JOIN cattle c ON fu.cattle_id=c.id
        WHERE fu.user_id=%s ORDER BY fu.created_at DESC LIMIT 3
    """, (user_id,))
    for a in cursor.fetchall():
        raw.append({
            'ts': a['created_at'],
            'icon': 'grass', 'color': 'green',
            'title': 'Feed distributed to cattle',
            'description': f"{a['cn'] or 'General'} consumed {float(a['quantity_used']):.1f} kg {a['feed_name']}",
            'time': get_time_ago(a['created_at']),
            'link': f"/cattle/{a['cid']}" if a['cid'] else '/feed'
        })

    cursor.execute("""
        SELECT amount, category, description, created_at
        FROM expenses WHERE user_id=%s ORDER BY created_at DESC LIMIT 3
    """, (user_id,))
    for a in cursor.fetchall():
        raw.append({
            'ts': a['created_at'],
            'icon': 'payments', 'color': 'amber',
            'title': f"Expense: {a['category'] or 'General'}",
            'description': f"₹{float(a['amount']):.0f}{(' · ' + a['description']) if a['description'] else ''}",
            'time': get_time_ago(a['created_at']),
            'link': '/expenses'
        })

    # Sort by time desc, keep only top 5
    raw.sort(key=lambda x: x['ts'] if x['ts'] else datetime.min, reverse=True)
    recent_activities = raw[:5]
    for a in recent_activities:
        a.pop('ts', None)

    # ── SMART ALERTS ──
    alerts = []

    # Low feed stock
    cursor.execute("""
        SELECT feed_name, quantity, min_quantity
        FROM feed_stock WHERE user_id=%s AND quantity < min_quantity
    """, (user_id,))
    for s in cursor.fetchall():
        pct = int(float(s['quantity']) / float(s['min_quantity']) * 100) if s['min_quantity'] > 0 else 0
        alerts.append({
            'type': 'danger', 'dot_color': 'danger',
            'title': f"Low Feed Stock: {s['feed_name']}",
            'description': f"Only {float(s['quantity']):.1f} kg left ({pct}% of minimum)",
            'link': '/feed'
        })

    # Vet checkups within 7 days
    cursor.execute("""
        SELECT hr.next_checkup, hr.vet_name, c.name AS cn, c.id AS cid
        FROM health_records hr JOIN cattle c ON hr.cattle_id=c.id
        WHERE hr.user_id=%s AND hr.next_checkup>=%s AND hr.next_checkup<=%s
        ORDER BY hr.next_checkup ASC LIMIT 5
    """, (user_id, today, today + timedelta(days=7)))
    for a in cursor.fetchall():
        dl = (a['next_checkup'] - today).days
        lbl = "Today" if dl == 0 else f"in {dl}d"
        alerts.append({
            'type': 'warning', 'dot_color': 'warning',
            'title': f"Vet Checkup: {a['cn']}",
            'description': f"{a['vet_name']} · Due {lbl} ({a['next_checkup'].strftime('%b %d')})",
            'link': f"/cattle/{a['cid']}"
        })

    # Low milk: 3+ of last 5 days < 50% of 30-day avg
    cursor.execute("SELECT id, name FROM cattle WHERE user_id=%s", (user_id,))
    cattle_list = cursor.fetchall()

    for ct in cattle_list:
        cid = ct['id']
        cursor.execute("""
            SELECT COALESCE(AVG(milk_liters),0) AS avg30
            FROM milk_records WHERE cattle_id=%s AND user_id=%s
            AND date >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
        """, (cid, user_id))
        avg30 = float(cursor.fetchone()['avg30'])
        if avg30 < 0.1: continue

        cursor.execute("""
            SELECT COUNT(*) AS low_days FROM milk_records
            WHERE cattle_id=%s AND user_id=%s
            AND date >= DATE_SUB(CURDATE(), INTERVAL 5 DAY)
            AND milk_liters < %s
        """, (cid, user_id, avg30 * 0.5))
        if cursor.fetchone()['low_days'] >= 3:
            alerts.append({
                'type': 'warning', 'dot_color': 'warning',
                'title': f"Low Milk Yield: {ct['name']}",
                'description': f"3+ recent days below 50% of avg ({avg30:.1f} L)",
                'link': f"/cattle/{cid}"
            })

    # Low feed intake: 3+ of last 5 days < 50% of avg
    cursor.execute("""
        SELECT cattle_id, AVG(qty) AS avg_feed
        FROM (
            SELECT cattle_id, usage_date, SUM(quantity_used) AS qty
            FROM feed_usage
            WHERE user_id=%s AND cattle_id IS NOT NULL
            AND usage_date >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
            GROUP BY cattle_id, usage_date
        ) daily GROUP BY cattle_id
    """, (user_id,))
    avg_feed_map = {r['cattle_id']: float(r['avg_feed']) for r in cursor.fetchall()}

    for ct in cattle_list:
        cid   = ct['id']
        avg_f = avg_feed_map.get(cid, 0)
        if avg_f < 0.1: continue
        cursor.execute("""
            SELECT COUNT(*) AS low_days
            FROM (
                SELECT usage_date, SUM(quantity_used) AS total
                FROM feed_usage WHERE user_id=%s AND cattle_id=%s
                AND usage_date >= DATE_SUB(CURDATE(), INTERVAL 5 DAY)
                GROUP BY usage_date
            ) daily WHERE total < %s
        """, (user_id, cid, avg_f * 0.5))
        if cursor.fetchone()['low_days'] >= 3:
            alerts.append({
                'type': 'warning', 'dot_color': 'warning',
                'title': f"Low Feed Intake: {ct['name']}",
                'description': f"3+ recent days below 50% of avg ({avg_f:.1f} kg)",
                'link': f"/cattle/{cid}"
            })

    # Always show at least one item — "All systems normal" when no genuine alerts
    if not alerts:
        alerts.append({
            'type': 'success', 'dot_color': 'success',
            'title': 'All Systems Normal',
            'description': 'No alerts at the moment — your farm is running smoothly',
            'link': '#'
        })

    # ── Dashboard meta for JS ──
    dashboard_meta = {
        'user_name':      session.get('full_name', 'User'),
        'total_cattle':   total_cattle,
        'monthly_revenue': monthly_revenue,
        'start_date':     (today.replace(day=1)).strftime('%Y-%m-%d'),
        'end_date':       today.strftime('%Y-%m-%d'),
    }

    cursor.close()
    connection.close()

    return render_template(
        'dashboard.html',
        user_name        = session.get('full_name', 'User'),
        total_cattle     = total_cattle,
        cattle_change    = 2.4,
        milk_today       = milk_today,
        milk_change      = -1.2,
        monthly_revenue  = monthly_revenue,
        revenue_change   = 5.8,
        weekly_milk_data = weekly_milk_data,
        monthly_milk_data= monthly_milk_data,
        recent_activities= recent_activities,
        alerts           = alerts,
        dashboard_meta   = dashboard_meta,
        now              = datetime.now()
    )


# ─── API: cattle list + today's milk/feed sets ───────────────────
@dashboard_bp.route('/api/cattle-list')
def api_cattle_list():
    user_id = session.get('user_id')
    if not user_id:
        return jsonify({'success': False, 'error': 'Not authenticated'}), 401

    today = datetime.now().date()
    conn  = get_db()
    cur   = conn.cursor(dictionary=True)
    try:
        cur.execute(
            "SELECT id, name, tag_no, breed, health FROM cattle WHERE user_id=%s ORDER BY name",
            (user_id,)
        )
        cattle = cur.fetchall()

        # Cattle that already have a milk record for today
        cur.execute("""
            SELECT DISTINCT cattle_id FROM milk_records
            WHERE user_id=%s AND date=%s
        """, (user_id, today))
        milk_today_ids = [r['cattle_id'] for r in cur.fetchall()]

        # Cattle that already have a feed record for today
        cur.execute("""
            SELECT DISTINCT cattle_id FROM feed_usage
            WHERE user_id=%s AND usage_date=%s AND cattle_id IS NOT NULL
        """, (user_id, today))
        feed_today_ids = [r['cattle_id'] for r in cur.fetchall()]

        return jsonify({
            'success':        True,
            'cattle':         cattle,
            'milk_today_ids': milk_today_ids,
            'feed_today_ids': feed_today_ids,
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500
    finally:
        cur.close(); conn.close()


# ─── API: report data (milk summary + feed summary) ─────────────
@dashboard_bp.route('/api/report-data')
def api_report_data():
    user_id    = session.get('user_id')
    if not user_id:
        return jsonify({'success': False, 'error': 'Not authenticated'}), 401

    start_date = request.args.get('start')
    end_date   = request.args.get('end')
    if not start_date or not end_date:
        return jsonify({'success': False, 'error': 'Missing dates'}), 400

    conn = get_db()
    cur  = conn.cursor(dictionary=True)
    try:
        # Milk summary per cattle
        cur.execute("""
            SELECT c.name, c.tag_no,
                   COALESCE(SUM(mr.milk_liters),0) AS total_milk,
                   COALESCE(AVG(mr.milk_liters),0) AS avg_milk,
                   COALESCE(SUM(mr.income),0)      AS total_income,
                   COUNT(mr.id)                     AS records
            FROM cattle c
            LEFT JOIN milk_records mr
              ON c.id = mr.cattle_id AND mr.date BETWEEN %s AND %s
            WHERE c.user_id = %s
            GROUP BY c.id ORDER BY c.name
        """, (start_date, end_date, user_id))
        milk_summary = cur.fetchall()
        for r in milk_summary:
            r['total_milk']   = float(r['total_milk'])
            r['avg_milk']     = float(r['avg_milk'])
            r['total_income'] = float(r['total_income'])

        # Feed summary per feed type
        cur.execute("""
            SELECT fs.feed_name, fs.cost_per_kg,
                   COALESCE(SUM(fu.quantity_used),0)                  AS total_qty,
                   COALESCE(SUM(fu.quantity_used * fs.cost_per_kg),0) AS total_cost
            FROM feed_usage fu
            JOIN feed_stock fs ON fu.feed_id = fs.id
            WHERE fu.user_id=%s AND fu.usage_date BETWEEN %s AND %s
            GROUP BY fu.feed_id ORDER BY fs.feed_name
        """, (user_id, start_date, end_date))
        feed_summary = cur.fetchall()
        for r in feed_summary:
            r['total_qty']  = float(r['total_qty'])
            r['total_cost'] = float(r['total_cost'])
            r['cost_per_kg']= float(r['cost_per_kg'])

        return jsonify({
            'success':      True,
            'milk_summary': milk_summary,
            'feed_summary': feed_summary,
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500
    finally:
        cur.close(); conn.close()
    
