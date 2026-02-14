from flask import Blueprint, render_template, request, jsonify, session, redirect, url_for, send_file
from datetime import datetime, timedelta
from db import get_db
from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.units import inch
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer, PageBreak
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_CENTER
import io

cattle_detail_bp = Blueprint('cattle_detail', __name__)


# ─────────────────────────────────────────────
# MAIN PAGE
# ─────────────────────────────────────────────
@cattle_detail_bp.route('/cattle/<int:id>')
def cattle_detail(id):
    user_id = session.get('user_id')
    if not user_id:
        return redirect(url_for('auth.login'))

    conn = get_db()
    if not conn:
        return "Database connection error", 500
    cur = conn.cursor(dictionary=True)

    try:
        cur.execute("SELECT * FROM cattle WHERE id = %s AND user_id = %s", (id, user_id))
        cattle = cur.fetchone()
        if not cattle:
            return "Cattle not found", 404

        # Last 7-day chart data
        cur.execute("""
            SELECT date, milk_liters, income FROM milk_records
            WHERE cattle_id = %s AND user_id = %s
              AND date >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)
            ORDER BY date ASC
        """, (id, user_id))
        milk_chart_data = cur.fetchall()

        cur.execute("""
            SELECT COALESCE(SUM(milk_liters),0) AS total_milk,
                   COALESCE(SUM(income),0)      AS total_income,
                   COUNT(*)                      AS total_records
            FROM milk_records WHERE cattle_id=%s AND user_id=%s
        """, (id, user_id))
        milk_stats = cur.fetchone()

        cur.execute("""
            SELECT COALESCE(AVG(milk_liters),0) AS avg_yield
            FROM milk_records WHERE cattle_id=%s AND user_id=%s
              AND date >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)
        """, (id, user_id))
        avg_yield = cur.fetchone()['avg_yield']

        cur.execute("""
            SELECT * FROM milk_records WHERE cattle_id=%s AND user_id=%s
            ORDER BY date DESC LIMIT 10
        """, (id, user_id))
        milk_records = cur.fetchall()

        cur.execute("""
            SELECT * FROM health_records WHERE cattle_id=%s AND user_id=%s
            ORDER BY created_at DESC LIMIT 10
        """, (id, user_id))
        health_records = cur.fetchall()

        for r in milk_chart_data:
            if isinstance(r['date'], datetime):
                r['date'] = r['date'].strftime('%Y-%m-%d')

        return render_template('cattle_detail.html',
                               cattle=cattle,
                               milk_chart_data=milk_chart_data,
                               milk_stats=milk_stats,
                               avg_yield=round(float(avg_yield), 1),
                               milk_records=milk_records,
                               health_records=health_records,
                               user_name=session.get('full_name', 'User'))
    finally:
        cur.close()
        conn.close()


# ─────────────────────────────────────────────
# MILK RECORDS — paginated list
# ─────────────────────────────────────────────
@cattle_detail_bp.route('/cattle/<int:id>/milk')
def get_milk_records(id):
    user_id  = session.get('user_id')
    page     = request.args.get('page', 1, type=int)
    per_page = request.args.get('per_page', 5, type=int)
    conn = get_db(); cur = conn.cursor(dictionary=True)
    try:
        cur.execute("SELECT COUNT(*) AS total FROM milk_records WHERE cattle_id=%s AND user_id=%s", (id, user_id))
        total = cur.fetchone()['total']
        cur.execute("""
            SELECT * FROM milk_records WHERE cattle_id=%s AND user_id=%s
            ORDER BY date DESC LIMIT %s OFFSET %s
        """, (id, user_id, per_page, (page-1)*per_page))
        records = cur.fetchall()
        for r in records:
            if isinstance(r.get('date'), (datetime,)):
                r['date'] = r['date'].strftime('%Y-%m-%d')
        return jsonify({'success': True, 'records': records, 'total': total,
                        'page': page, 'per_page': per_page,
                        'total_pages': (total + per_page - 1) // per_page})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500
    finally:
        cur.close(); conn.close()


# ─────────────────────────────────────────────
# MILK CHART DATA
# ─────────────────────────────────────────────
@cattle_detail_bp.route('/cattle/<int:id>/milk-chart')
def get_milk_chart_data(id):
    user_id    = session.get('user_id')
    days       = request.args.get('days', type=int)
    start_date = request.args.get('start_date')
    end_date   = request.args.get('end_date')
    conn = get_db(); cur = conn.cursor(dictionary=True)
    try:
        q = "SELECT date, milk_liters, income FROM milk_records WHERE cattle_id=%s AND user_id=%s"
        params = [id, user_id]
        if start_date and end_date:
            q += " AND date BETWEEN %s AND %s"; params += [start_date, end_date]
        elif days:
            q += " AND date >= DATE_SUB(CURDATE(), INTERVAL %s DAY)"; params.append(days)
        else:
            q += " AND date >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)"
        q += " ORDER BY date ASC"
        cur.execute(q, params)
        data = cur.fetchall()
        for r in data:
            if isinstance(r.get('date'), datetime):
                r['date'] = r['date'].strftime('%Y-%m-%d')
        return jsonify({'success': True, 'data': data})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500
    finally:
        cur.close(); conn.close()


# ─────────────────────────────────────────────
# FEED USAGE — for scatter chart
# Personal rows + equally divided general (cattle_id IS NULL) rows
# ─────────────────────────────────────────────
@cattle_detail_bp.route('/cattle/<int:id>/feed-usage')
def get_feed_usage(id):
    user_id    = session.get('user_id')
    days       = request.args.get('days', type=int)
    start_date = request.args.get('start_date')
    end_date   = request.args.get('end_date')
    conn = get_db(); cur = conn.cursor(dictionary=True)
    try:
        date_clause = ""
        p_personal = [id, user_id]
        p_general  = [user_id]

        if start_date and end_date:
            date_clause = " AND fu.usage_date BETWEEN %s AND %s"
            p_personal += [start_date, end_date]
            p_general  += [start_date, end_date]
        elif days:
            date_clause = " AND fu.usage_date >= DATE_SUB(CURDATE(), INTERVAL %s DAY)"
            p_personal.append(days); p_general.append(days)
        else:
            date_clause = " AND fu.usage_date >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)"

        # Personal
        cur.execute(f"""
            SELECT fu.usage_date, SUM(fu.quantity_used) AS qty
            FROM feed_usage fu
            WHERE fu.cattle_id=%s AND fu.user_id=%s {date_clause}
            GROUP BY fu.usage_date
        """, p_personal)
        personal_map = {str(r['usage_date']): float(r['qty']) for r in cur.fetchall()}

        # General (divided equally)
        cur.execute("SELECT COUNT(*) AS cnt FROM cattle WHERE user_id=%s", (user_id,))
        n_cattle = cur.fetchone()['cnt'] or 1

        cur.execute(f"""
            SELECT fu.usage_date, SUM(fu.quantity_used) AS qty
            FROM feed_usage fu
            WHERE fu.cattle_id IS NULL AND fu.user_id=%s {date_clause}
            GROUP BY fu.usage_date
        """, p_general)
        general_map = {}
        for r in cur.fetchall():
            k = str(r['usage_date']); general_map[k] = general_map.get(k, 0) + float(r['qty']) / n_cattle

        all_dates = sorted(set(list(personal_map) + list(general_map)))
        result = [{'usage_date': d, 'quantity_used': round(personal_map.get(d, 0) + general_map.get(d, 0), 2)} for d in all_dates]
        return jsonify({'success': True, 'data': result})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500
    finally:
        cur.close(); conn.close()


# ─────────────────────────────────────────────
# FEED RECORDS TABLE (personal only for display)
# ─────────────────────────────────────────────
@cattle_detail_bp.route('/cattle/<int:id>/feed-records')
def get_feed_records(id):
    user_id  = session.get('user_id')
    page     = request.args.get('page', 1, type=int)
    per_page = request.args.get('per_page', 5, type=int)
    conn = get_db(); cur = conn.cursor(dictionary=True)
    try:
        cur.execute("""
            SELECT COUNT(*) AS total FROM feed_usage fu
            WHERE fu.cattle_id=%s AND fu.user_id=%s
        """, (id, user_id))
        total = cur.fetchone()['total']

        cur.execute("""
            SELECT fu.id, fu.usage_date, fu.quantity_used, fu.feed_id,
                   fs.feed_name, fs.cost_per_kg
            FROM feed_usage fu
            JOIN feed_stock fs ON fu.feed_id = fs.id
            WHERE fu.cattle_id=%s AND fu.user_id=%s
            ORDER BY fu.usage_date DESC
            LIMIT %s OFFSET %s
        """, (id, user_id, per_page, (page-1)*per_page))
        records = cur.fetchall()
        for r in records:
            if isinstance(r.get('usage_date'), datetime):
                r['usage_date'] = r['usage_date'].strftime('%Y-%m-%d')
        return jsonify({'success': True, 'records': records, 'total': total,
                        'page': page, 'per_page': per_page,
                        'total_pages': (total + per_page - 1) // per_page})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500
    finally:
        cur.close(); conn.close()


# ─────────────────────────────────────────────
# FINANCIAL SUMMARY
# ─────────────────────────────────────────────
@cattle_detail_bp.route('/cattle/<int:id>/summary')
def get_summary(id):
    user_id = session.get('user_id')
    days    = request.args.get('days', 30, type=int)
    conn = get_db(); cur = conn.cursor(dictionary=True)
    try:
        date_filter     = "" if days == 0 else "AND date >= DATE_SUB(CURDATE(), INTERVAL %s DAY)"
        date_filter_ts  = "" if days == 0 else "AND DATE(created_at) >= DATE_SUB(CURDATE(), INTERVAL %s DAY)"
        date_filter_fu  = "" if days == 0 else "AND fu.usage_date >= DATE_SUB(CURDATE(), INTERVAL %s DAY)"
        params_d = (id, user_id, days) if days else (id, user_id)

        # Milk income
        cur.execute(f"""
            SELECT COALESCE(SUM(income),0) AS income,
                   COALESCE(SUM(milk_liters),0) AS total_liters
            FROM milk_records WHERE cattle_id=%s AND user_id=%s {date_filter}
        """, params_d)
        milk_row = cur.fetchone()

        # Feed cost (personal + share of general)
        cur.execute("SELECT COUNT(*) AS cnt FROM cattle WHERE user_id=%s", (user_id,))
        n_cattle = cur.fetchone()['cnt'] or 1

        params_feed_p = (id, user_id, days) if days else (id, user_id)
        params_feed_g = (user_id, days) if days else (user_id,)
        date_fu_p = date_filter_fu.replace('fu.usage_date', 'fu.usage_date') if days else ""
        date_fu_g = date_filter_fu.replace('fu.usage_date', 'fu.usage_date') if days else ""

        cur.execute(f"""
            SELECT COALESCE(SUM(fu.quantity_used * fs.cost_per_kg),0) AS feed_cost,
                   COALESCE(SUM(fu.quantity_used),0) AS feed_kg
            FROM feed_usage fu JOIN feed_stock fs ON fu.feed_id=fs.id
            WHERE fu.cattle_id=%s AND fu.user_id=%s {date_fu_p}
        """, params_feed_p)
        personal_feed = cur.fetchone()

        cur.execute(f"""
            SELECT COALESCE(SUM(fu.quantity_used * fs.cost_per_kg),0) AS feed_cost,
                   COALESCE(SUM(fu.quantity_used),0) AS feed_kg
            FROM feed_usage fu JOIN feed_stock fs ON fu.feed_id=fs.id
            WHERE fu.cattle_id IS NULL AND fu.user_id=%s {date_fu_g}
        """, params_feed_g)
        general_feed = cur.fetchone()

        total_feed_cost = float(personal_feed['feed_cost']) + float(general_feed['feed_cost']) / n_cattle
        total_feed_kg   = float(personal_feed['feed_kg'])   + float(general_feed['feed_kg'])   / n_cattle

        # Health records count (cost tracking can be extended later)
        params_h = (id, user_id, days) if days else (id, user_id)
        cur.execute(f"""
            SELECT COUNT(*) AS cnt FROM health_records
            WHERE cattle_id=%s AND user_id=%s {date_filter_ts}
        """, params_h)
        health_count = cur.fetchone()['cnt']

        return jsonify({
            'success':         True,
            'income':          float(milk_row['income']),
            'total_liters':    float(milk_row['total_liters']),
            'feed_cost':       round(total_feed_cost, 2),
            'feed_kg':         round(total_feed_kg, 2),
            'health_cost':     0,          # extend if you track vet costs
            'health_records':  health_count,
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500
    finally:
        cur.close(); conn.close()


# ─────────────────────────────────────────────
# ADD MILK RECORD
# ─────────────────────────────────────────────
@cattle_detail_bp.route('/cattle/<int:id>/add-milk', methods=['POST'])
def add_milk_record(id):
    user_id = session.get('user_id')
    try:
        data = request.get_json()
        morning = float(data.get('morning_liters', 0))
        evening = float(data.get('evening_liters', 0))
        rate    = float(data.get('rate', 0))
        income  = (morning + evening) * rate

        conn = get_db(); cur = conn.cursor()
        cur.execute("SELECT id FROM cattle WHERE id=%s AND user_id=%s", (id, user_id))
        if not cur.fetchone():
            return jsonify({'success': False, 'error': 'Cattle not found'}), 404

        cur.execute("""
            INSERT INTO milk_records (user_id,cattle_id,date,morning_liters,evening_liters,rate,income)
            VALUES (%s,%s,%s,%s,%s,%s,%s)
        """, (user_id, id, data['date'], morning, evening, rate, income))
        conn.commit()
        return jsonify({'success': True, 'message': 'Milk record added'})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500
    finally:
        cur.close(); conn.close()


# ─────────────────────────────────────────────
# UPDATE MILK RECORD
# ─────────────────────────────────────────────
@cattle_detail_bp.route('/cattle/<int:id>/update-milk/<int:record_id>', methods=['POST'])
def update_milk_record(id, record_id):
    user_id = session.get('user_id')
    try:
        data    = request.get_json()
        morning = float(data.get('morning_liters', 0))
        evening = float(data.get('evening_liters', 0))
        rate    = float(data.get('rate', 0))
        income  = (morning + evening) * rate

        conn = get_db(); cur = conn.cursor()
        cur.execute("SELECT id FROM milk_records WHERE id=%s AND cattle_id=%s AND user_id=%s", (record_id, id, user_id))
        if not cur.fetchone():
            return jsonify({'success': False, 'error': 'Record not found'}), 404

        cur.execute("""
            UPDATE milk_records SET date=%s, morning_liters=%s, evening_liters=%s, rate=%s, income=%s
            WHERE id=%s AND cattle_id=%s AND user_id=%s
        """, (data['date'], morning, evening, rate, income, record_id, id, user_id))
        conn.commit()
        return jsonify({'success': True, 'message': 'Record updated'})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500
    finally:
        cur.close(); conn.close()


# ─────────────────────────────────────────────
# DELETE MILK RECORD
# ─────────────────────────────────────────────
@cattle_detail_bp.route('/cattle/<int:id>/delete-milk/<int:record_id>', methods=['POST'])
def delete_milk_record(id, record_id):
    user_id = session.get('user_id')
    try:
        conn = get_db(); cur = conn.cursor()
        cur.execute("SELECT id FROM milk_records WHERE id=%s AND cattle_id=%s AND user_id=%s", (record_id, id, user_id))
        if not cur.fetchone():
            return jsonify({'success': False, 'error': 'Record not found'}), 404
        cur.execute("DELETE FROM milk_records WHERE id=%s AND cattle_id=%s AND user_id=%s", (record_id, id, user_id))
        conn.commit()
        return jsonify({'success': True})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500
    finally:
        cur.close(); conn.close()


# ─────────────────────────────────────────────
# ADD FEED RECORD (always personal cattle_id)
# Also decrements feed_stock quantity
# ─────────────────────────────────────────────
@cattle_detail_bp.route('/cattle/<int:id>/add-feed', methods=['POST'])
def add_feed_record(id):
    user_id = session.get('user_id')
    try:
        data     = request.get_json()
        feed_id  = int(data.get('feed_id'))
        qty      = float(data.get('quantity_used'))
        use_date = data.get('usage_date')

        conn = get_db(); cur = conn.cursor(dictionary=True)

        # Verify cattle
        cur.execute("SELECT id FROM cattle WHERE id=%s AND user_id=%s", (id, user_id))
        if not cur.fetchone():
            return jsonify({'success': False, 'error': 'Cattle not found'}), 404

        # Verify feed & check stock
        cur.execute("SELECT id, quantity FROM feed_stock WHERE id=%s AND user_id=%s", (feed_id, user_id))
        feed = cur.fetchone()
        if not feed:
            return jsonify({'success': False, 'error': 'Feed not found'}), 404
        if float(feed['quantity']) < qty:
            return jsonify({'success': False, 'error': f'Insufficient stock. Available: {float(feed["quantity"]):.1f} kg'}), 400

        # Insert usage
        cur2 = conn.cursor()
        cur2.execute("""
            INSERT INTO feed_usage (user_id, feed_id, cattle_id, quantity_used, usage_date)
            VALUES (%s, %s, %s, %s, %s)
        """, (user_id, feed_id, id, qty, use_date))

        # Decrement stock
        cur2.execute("UPDATE feed_stock SET quantity = quantity - %s WHERE id=%s AND user_id=%s", (qty, feed_id, user_id))
        conn.commit()
        return jsonify({'success': True, 'message': 'Feed record added'})
    except Exception as e:
        if 'conn' in locals(): conn.rollback()
        return jsonify({'success': False, 'error': str(e)}), 500
    finally:
        if 'cur' in locals():  cur.close()
        if 'cur2' in locals(): cur2.close()
        if 'conn' in locals(): conn.close()


# ─────────────────────────────────────────────
# UPDATE FEED RECORD
# Adjusts feed_stock delta (old qty restored, new qty deducted)
# ─────────────────────────────────────────────
@cattle_detail_bp.route('/cattle/<int:id>/update-feed/<int:record_id>', methods=['POST'])
def update_feed_record(id, record_id):
    user_id = session.get('user_id')
    try:
        data     = request.get_json()
        new_qty  = float(data.get('quantity_used'))
        new_feed = int(data.get('feed_id'))
        use_date = data.get('usage_date')

        conn = get_db(); cur = conn.cursor(dictionary=True)

        # Get old record
        cur.execute("SELECT * FROM feed_usage WHERE id=%s AND cattle_id=%s AND user_id=%s", (record_id, id, user_id))
        old = cur.fetchone()
        if not old:
            return jsonify({'success': False, 'error': 'Record not found'}), 404

        old_qty  = float(old['quantity_used'])
        old_feed = int(old['feed_id'])

        cur2 = conn.cursor()

        # Restore old stock
        cur2.execute("UPDATE feed_stock SET quantity = quantity + %s WHERE id=%s AND user_id=%s", (old_qty, old_feed, user_id))

        # Check new stock
        cur.execute("SELECT quantity FROM feed_stock WHERE id=%s AND user_id=%s", (new_feed, user_id))
        stock = cur.fetchone()
        if not stock or float(stock['quantity']) + (old_qty if old_feed == new_feed else 0) < new_qty:
            conn.rollback()
            return jsonify({'success': False, 'error': 'Insufficient stock for new quantity'}), 400

        # Deduct new stock
        cur2.execute("UPDATE feed_stock SET quantity = quantity - %s WHERE id=%s AND user_id=%s", (new_qty, new_feed, user_id))

        # Update record
        cur2.execute("""
            UPDATE feed_usage SET usage_date=%s, feed_id=%s, quantity_used=%s
            WHERE id=%s AND cattle_id=%s AND user_id=%s
        """, (use_date, new_feed, new_qty, record_id, id, user_id))
        conn.commit()
        return jsonify({'success': True, 'message': 'Feed record updated'})
    except Exception as e:
        if 'conn' in locals(): conn.rollback()
        return jsonify({'success': False, 'error': str(e)}), 500
    finally:
        if 'cur' in locals():  cur.close()
        if 'cur2' in locals(): cur2.close()
        if 'conn' in locals(): conn.close()


# ─────────────────────────────────────────────
# DELETE FEED RECORD
# Restores stock quantity
# ─────────────────────────────────────────────
@cattle_detail_bp.route('/cattle/<int:id>/delete-feed/<int:record_id>', methods=['POST'])
def delete_feed_record(id, record_id):
    user_id = session.get('user_id')
    try:
        conn = get_db(); cur = conn.cursor(dictionary=True)
        cur.execute("SELECT * FROM feed_usage WHERE id=%s AND cattle_id=%s AND user_id=%s", (record_id, id, user_id))
        rec = cur.fetchone()
        if not rec:
            return jsonify({'success': False, 'error': 'Record not found'}), 404

        cur2 = conn.cursor()
        # Restore stock
        cur2.execute("UPDATE feed_stock SET quantity = quantity + %s WHERE id=%s AND user_id=%s",
                     (float(rec['quantity_used']), rec['feed_id'], user_id))
        cur2.execute("DELETE FROM feed_usage WHERE id=%s AND cattle_id=%s AND user_id=%s", (record_id, id, user_id))
        conn.commit()
        return jsonify({'success': True})
    except Exception as e:
        if 'conn' in locals(): conn.rollback()
        return jsonify({'success': False, 'error': str(e)}), 500
    finally:
        if 'cur' in locals():  cur.close()
        if 'cur2' in locals(): cur2.close()
        if 'conn' in locals(): conn.close()


# ─────────────────────────────────────────────
# ADD HEALTH RECORD
# ─────────────────────────────────────────────
@cattle_detail_bp.route('/cattle/<int:id>/add-health', methods=['POST'])
def add_health_record(id):
    user_id = session.get('user_id')
    try:
        data = request.get_json()
        conn = get_db(); cur = conn.cursor()
        cur.execute("SELECT id FROM cattle WHERE id=%s AND user_id=%s", (id, user_id))
        if not cur.fetchone():
            return jsonify({'success': False, 'error': 'Cattle not found'}), 404
        cur.execute("""
            INSERT INTO health_records (user_id,cattle_id,issue,treatment,vet_name,next_checkup)
            VALUES (%s,%s,%s,%s,%s,%s)
        """, (user_id, id, data.get('issue'), data.get('treatment'), data.get('vet_name'), data.get('next_checkup')))
        conn.commit()
        return jsonify({'success': True, 'message': 'Health record added'})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500
    finally:
        cur.close(); conn.close()


# ─────────────────────────────────────────────
# UPDATE CATTLE
# ─────────────────────────────────────────────
@cattle_detail_bp.route('/cattle/<int:id>/update', methods=['POST'])
def update_cattle(id):
    user_id = session.get('user_id')
    try:
        data = request.get_json()
        conn = get_db(); cur = conn.cursor()
        cur.execute("SELECT id FROM cattle WHERE id=%s AND user_id=%s", (id, user_id))
        if not cur.fetchone():
            return jsonify({'success': False, 'error': 'Cattle not found'}), 404
        cur.execute("""
            UPDATE cattle SET name=%s, tag_no=%s, breed=%s, age=%s, gender=%s, health=%s
            WHERE id=%s AND user_id=%s
        """, (data['name'], data.get('tag_no'), data['breed'], data['age'], data['gender'], data['health'], id, user_id))
        conn.commit()
        return jsonify({'success': True})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500
    finally:
        cur.close(); conn.close()


# ─────────────────────────────────────────────
# GENERATE PDF REPORT
# ─────────────────────────────────────────────
@cattle_detail_bp.route('/cattle/<int:id>/generate-pdf')
def generate_pdf(id):
    user_id    = session.get('user_id')
    start_date = request.args.get('start_date')
    end_date   = request.args.get('end_date')
    conn = get_db(); cur = conn.cursor(dictionary=True)
    try:
        cur.execute("SELECT * FROM cattle WHERE id=%s AND user_id=%s", (id, user_id))
        cattle = cur.fetchone()
        if not cattle:
            return "Cattle not found", 404

        cur.execute("""
            SELECT * FROM milk_records WHERE cattle_id=%s AND user_id=%s
              AND date BETWEEN %s AND %s ORDER BY date DESC
        """, (id, user_id, start_date, end_date))
        milk_records = cur.fetchall()

        cur.execute("""
            SELECT hr.*, fs.feed_name, fs.cost_per_kg FROM feed_usage hr
            JOIN feed_stock fs ON hr.feed_id=fs.id
            WHERE hr.cattle_id=%s AND hr.user_id=%s
              AND hr.usage_date BETWEEN %s AND %s ORDER BY hr.usage_date DESC
        """, (id, user_id, start_date, end_date))
        feed_records = cur.fetchall()

        cur.execute("""
            SELECT * FROM health_records WHERE cattle_id=%s AND user_id=%s
              AND DATE(created_at) BETWEEN %s AND %s ORDER BY created_at DESC
        """, (id, user_id, start_date, end_date))
        health_records = cur.fetchall()

        cur.execute("""
            SELECT COALESCE(SUM(milk_liters),0) AS total_milk,
                   COALESCE(AVG(milk_liters),0) AS avg_milk,
                   COALESCE(SUM(income),0)      AS total_income,
                   COUNT(*)                      AS total_records
            FROM milk_records WHERE cattle_id=%s AND user_id=%s
              AND date BETWEEN %s AND %s
        """, (id, user_id, start_date, end_date))
        stats = cur.fetchone()

        # Build PDF
        buf = io.BytesIO()
        doc = SimpleDocTemplate(buf, pagesize=A4, topMargin=0.5*inch, bottomMargin=0.5*inch)
        styles = getSampleStyleSheet()
        title_style = ParagraphStyle('T', parent=styles['Heading1'], fontSize=22,
                                     textColor=colors.HexColor('#667eea'), alignment=TA_CENTER,
                                     spaceAfter=20, fontName='Helvetica-Bold')
        h2 = ParagraphStyle('H2', parent=styles['Heading2'], fontSize=14,
                             textColor=colors.HexColor('#1f2937'), spaceAfter=10, spaceBefore=18)
        norm = ParagraphStyle('N', parent=styles['Normal'], fontSize=10, textColor=colors.HexColor('#374151'))

        story = [Paragraph(f"Cattle Report — {cattle['name']}", title_style),
                 Paragraph(f"<b>Period:</b> {start_date} to {end_date}", norm),
                 Paragraph(f"<b>Generated:</b> {datetime.now().strftime('%B %d, %Y %I:%M %p')}", norm),
                 Spacer(1, 0.25*inch)]

        def make_table(data, col_widths, header_color):
            t = Table(data, colWidths=col_widths)
            t.setStyle(TableStyle([
                ('BACKGROUND', (0,0), (-1,0), colors.HexColor(header_color)),
                ('TEXTCOLOR', (0,0), (-1,0), colors.white),
                ('FONTNAME', (0,0), (-1,0), 'Helvetica-Bold'),
                ('FONTSIZE', (0,0), (-1,0), 10),
                ('BOTTOMPADDING', (0,0), (-1,0), 10),
                ('ALIGN', (0,0), (-1,-1), 'LEFT'),
                ('FONTNAME', (0,1), (-1,-1), 'Helvetica'),
                ('FONTSIZE', (0,1), (-1,-1), 9),
                ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor('#e5e7eb')),
                ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.white, colors.HexColor('#f9fafb')]),
            ]))
            return t

        # Cattle info
        story.append(Paragraph("Cattle Information", h2))
        story.append(make_table([
            ['Field','Value'],
            ['Tag / ID', f"#{cattle['tag_no'] or cattle['id']}"],
            ['Name', cattle['name']], ['Breed', cattle['breed']],
            ['Age', f"{cattle['age']} years"], ['Gender', cattle['gender']],
            ['Health', cattle['health']],
        ], [2*inch, 4*inch], '#667eea'))

        # Production stats
        story.append(Paragraph("Production Statistics", h2))
        story.append(make_table([
            ['Metric','Value'],
            ['Total Production', f"{float(stats['total_milk']):.1f} L"],
            ['Avg Daily Yield',  f"{float(stats['avg_milk']):.1f} L"],
            ['Total Income',     f"₹{float(stats['total_income']):.2f}"],
            ['Total Records',    str(stats['total_records'])],
        ], [3*inch, 3*inch], '#667eea'))

        # Milk records
        if milk_records:
            story.append(Paragraph("Milk Production Records", h2))
            rows = [['Date','Morning (L)','Evening (L)','Total (L)','Rate (₹)','Income (₹)']]
            for r in milk_records:
                ds = r['date'].strftime('%b %d, %Y') if isinstance(r['date'], datetime) else str(r['date'])
                rows.append([ds, f"{float(r['morning_liters']):.1f}", f"{float(r['evening_liters']):.1f}",
                              f"{float(r['milk_liters']):.1f}", f"₹{float(r['rate']):.2f}", f"₹{float(r['income']):.2f}"])
            story.append(make_table(rows, [1.3*inch,1*inch,1*inch,1*inch,1.1*inch,1.1*inch], '#22c55e'))

        # Feed records
        if feed_records:
            story.append(Paragraph("Feed Records", h2))
            rows = [['Date','Feed Type','Qty (kg)','Cost/kg (₹)','Total Cost (₹)']]
            for r in feed_records:
                ds  = r['usage_date'].strftime('%b %d, %Y') if isinstance(r['usage_date'], datetime) else str(r['usage_date'])
                qty = float(r['quantity_used']); cpk = float(r['cost_per_kg'])
                rows.append([ds, r['feed_name'], f"{qty:.1f}", f"₹{cpk:.2f}", f"₹{qty*cpk:.2f}"])
            story.append(make_table(rows, [1.3*inch,1.5*inch,1*inch,1.2*inch,1.2*inch], '#f59e0b'))

        # Health records
        if health_records:
            story.append(PageBreak())
            story.append(Paragraph("Health & Medical Records", h2))
            for i, r in enumerate(health_records):
                ds = r['created_at'].strftime('%b %d, %Y') if isinstance(r['created_at'], datetime) else str(r['created_at'])
                txt = f"<b>Date:</b> {ds}<br/><b>Issue:</b> {r['issue']}<br/><b>Treatment:</b> {r['treatment']}<br/><b>Vet:</b> {r['vet_name']}"
                if r.get('next_checkup'):
                    nd = r['next_checkup'].strftime('%b %d, %Y') if isinstance(r['next_checkup'], datetime) else str(r['next_checkup'])
                    txt += f"<br/><b>Next Checkup:</b> {nd}"
                story.append(Paragraph(txt, norm))
                if i < len(health_records) - 1:
                    story.append(Spacer(1, 0.2*inch))

        doc.build(story)
        buf.seek(0)
        return send_file(buf, as_attachment=True,
                         download_name=f"cattle_{id}_{start_date}_to_{end_date}.pdf",
                         mimetype='application/pdf')
    except Exception as e:
        return f"Error: {str(e)}", 500
    finally:
        cur.close(); conn.close()