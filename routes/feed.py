from flask import Blueprint, request, jsonify, session, render_template
from datetime import datetime, timedelta
from decimal import Decimal
import traceback
from db import get_db

feed_bp = Blueprint('feed', __name__)

@feed_bp.route('/feed')
def expense():
    user_name = session.get('full_name')
    return render_template('feed.html', user_name=user_name)


# ════════════════════════════════════════════════════════════════
# GET FEED METRICS
# ════════════════════════════════════════════════════════════════
@feed_bp.route('/api/feed/metrics', methods=['GET'])
def get_feed_metrics():
    try:
        user_id = session.get('user_id')
        if not user_id:
            return jsonify({'error': 'Unauthorized'}), 401

        from_date = request.args.get('from_date')
        to_date   = request.args.get('to_date')
        if not from_date or not to_date:
            today     = datetime.now()
            from_date = today.replace(day=1).strftime('%Y-%m-%d')
            to_date   = today.strftime('%Y-%m-%d')

        conn   = get_db()
        if not conn:
            return jsonify({'error': 'Database connection failed'}), 500
        cursor = conn.cursor(dictionary=True)

        cursor.execute("""
            SELECT COALESCE(SUM(fu.quantity_used), 0) as total_used
            FROM feed_usage fu
            WHERE fu.user_id = %s AND fu.usage_date BETWEEN %s AND %s
        """, (user_id, from_date, to_date))
        total_feed_used = float(cursor.fetchone()['total_used'])

        cursor.execute("""
            SELECT COALESCE(SUM(fu.quantity_used * fs.cost_per_kg), 0) as total_cost
            FROM feed_usage fu
            JOIN feed_stock fs ON fu.feed_id = fs.id
            WHERE fu.user_id = %s AND fu.usage_date BETWEEN %s AND %s
        """, (user_id, from_date, to_date))
        total_feed_cost = float(cursor.fetchone()['total_cost'])

        cursor.execute("""
            SELECT COUNT(DISTINCT cattle_id) as cattle_count
            FROM feed_usage
            WHERE user_id = %s AND usage_date BETWEEN %s AND %s AND cattle_id IS NOT NULL
        """, (user_id, from_date, to_date))
        cattle_count = cursor.fetchone()['cattle_count']
        avg_per_cattle = (total_feed_used / cattle_count) if cattle_count > 0 else 0.0

        cursor.execute("""
            SELECT COUNT(*) as low_stock_count
            FROM feed_stock
            WHERE user_id = %s AND quantity <= min_quantity
        """, (user_id,))
        low_stock_alerts = cursor.fetchone()['low_stock_count']

        cursor.close(); conn.close()
        return jsonify({
            'total_feed_used':  round(total_feed_used, 2),
            'total_feed_cost':  round(total_feed_cost, 2),
            'avg_per_cattle':   round(avg_per_cattle, 2),
            'low_stock_alerts': low_stock_alerts,
            'date_range': {'from': from_date, 'to': to_date}
        }), 200
    except Exception as e:
        print(f"Error in get_feed_metrics: {traceback.format_exc()}")
        return jsonify({'error': 'Internal server error', 'details': str(e)}), 500


# ════════════════════════════════════════════════════════════════
# GET FEED USAGE TIMELINE
# ════════════════════════════════════════════════════════════════
@feed_bp.route('/api/feed/usage-timeline', methods=['GET'])
def get_feed_usage_timeline():
    try:
        user_id = session.get('user_id')
        if not user_id:
            return jsonify({'error': 'Unauthorized'}), 401

        from_date = request.args.get('from_date')
        to_date   = request.args.get('to_date')
        if not from_date or not to_date:
            today     = datetime.now()
            from_date = today.replace(day=1).strftime('%Y-%m-%d')
            to_date   = today.strftime('%Y-%m-%d')

        conn   = get_db()
        if not conn:
            return jsonify({'error': 'Database connection failed'}), 500
        cursor = conn.cursor(dictionary=True)

        cursor.execute("""
            SELECT usage_date as date, COALESCE(SUM(quantity_used), 0) as total_quantity
            FROM feed_usage
            WHERE user_id = %s AND usage_date BETWEEN %s AND %s
            GROUP BY usage_date ORDER BY usage_date
        """, (user_id, from_date, to_date))
        records = cursor.fetchall()
        cursor.close(); conn.close()

        return jsonify({
            'timeline': [{'date': r['date'].strftime('%Y-%m-%d'), 'quantity': float(r['total_quantity'])} for r in records],
            'date_range': {'from': from_date, 'to': to_date}
        }), 200
    except Exception as e:
        print(f"Error in get_feed_usage_timeline: {traceback.format_exc()}")
        return jsonify({'error': 'Internal server error', 'details': str(e)}), 500


# ════════════════════════════════════════════════════════════════
# GET FEED TYPE DISTRIBUTION
# ════════════════════════════════════════════════════════════════
@feed_bp.route('/api/feed/type-distribution', methods=['GET'])
def get_feed_type_distribution():
    try:
        user_id = session.get('user_id')
        if not user_id:
            return jsonify({'error': 'Unauthorized'}), 401

        from_date = request.args.get('from_date')
        to_date   = request.args.get('to_date')
        if not from_date or not to_date:
            today     = datetime.now()
            from_date = today.replace(day=1).strftime('%Y-%m-%d')
            to_date   = today.strftime('%Y-%m-%d')

        conn   = get_db()
        if not conn:
            return jsonify({'error': 'Database connection failed'}), 500
        cursor = conn.cursor(dictionary=True)

        cursor.execute("""
            SELECT fs.feed_name, COALESCE(SUM(fu.quantity_used), 0) as total_quantity
            FROM feed_usage fu
            JOIN feed_stock fs ON fu.feed_id = fs.id
            WHERE fu.user_id = %s AND fu.usage_date BETWEEN %s AND %s
            GROUP BY fs.id, fs.feed_name HAVING total_quantity > 0
            ORDER BY total_quantity DESC
        """, (user_id, from_date, to_date))
        records = cursor.fetchall()
        cursor.close(); conn.close()

        return jsonify({
            'distribution': [{'label': r['feed_name'], 'value': float(r['total_quantity'])} for r in records],
            'date_range': {'from': from_date, 'to': to_date}
        }), 200
    except Exception as e:
        print(f"Error in get_feed_type_distribution: {traceback.format_exc()}")
        return jsonify({'error': 'Internal server error', 'details': str(e)}), 500


# ════════════════════════════════════════════════════════════════
# GET FEED HISTORY
# ════════════════════════════════════════════════════════════════
@feed_bp.route('/api/feed/history', methods=['GET'])
def get_feed_history():
    try:
        user_id = session.get('user_id')
        if not user_id:
            return jsonify({'error': 'Unauthorized'}), 401

        page             = int(request.args.get('page', 1))
        per_page         = int(request.args.get('per_page', 10))
        feed_type_filter = request.args.get('feed_type', 'all')
        cattle_filter    = request.args.get('cattle', 'all')
        from_date        = request.args.get('from_date')
        to_date          = request.args.get('to_date')

        if not from_date or not to_date:
            today     = datetime.now()
            from_date = today.replace(day=1).strftime('%Y-%m-%d')
            to_date   = today.strftime('%Y-%m-%d')

        conn   = get_db()
        if not conn:
            return jsonify({'error': 'Database connection failed'}), 500
        cursor = conn.cursor(dictionary=True)

        query = """
            SELECT fu.usage_date as date, c.name as cattle_name, fs.feed_name as feed_type,
                   fu.quantity_used as quantity, fs.cost_per_kg,
                   (fu.quantity_used * fs.cost_per_kg) as cost, fu.id
            FROM feed_usage fu
            JOIN feed_stock fs ON fu.feed_id = fs.id
            LEFT JOIN cattle c ON fu.cattle_id = c.id
            WHERE fu.user_id = %s AND fu.usage_date BETWEEN %s AND %s
        """
        params = [user_id, from_date, to_date]

        if feed_type_filter != 'all':
            query += " AND fs.feed_name = %s"; params.append(feed_type_filter)
        if cattle_filter != 'all':
            query += " AND c.name = %s"; params.append(cattle_filter)

        query += " ORDER BY fu.usage_date DESC"
        cursor.execute(query, params)
        all_records = cursor.fetchall()
        cursor.close(); conn.close()

        total    = len(all_records)
        start    = (page - 1) * per_page
        paginated = all_records[start:start + per_page]

        return jsonify({
            'history': [{
                'date':        r['date'].strftime('%Y-%m-%d'),
                'cattle_name': r['cattle_name'] or 'General Stock',
                'feed_type':   r['feed_type'],
                'quantity':    float(r['quantity']),
                'cost':        float(r['cost']),
                'cost_per_kg': float(r['cost_per_kg'])
            } for r in paginated],
            'pagination': {
                'page': page, 'per_page': per_page,
                'total': total, 'total_pages': (total + per_page - 1) // per_page
            },
            'date_range': {'from': from_date, 'to': to_date}
        }), 200
    except Exception as e:
        print(f"Error in get_feed_history: {traceback.format_exc()}")
        return jsonify({'error': 'Internal server error', 'details': str(e)}), 500


# ════════════════════════════════════════════════════════════════
# GET FEED STOCK LIST (dropdown — lightweight)
# ════════════════════════════════════════════════════════════════
@feed_bp.route('/api/feed/stock-list', methods=['GET'])
def get_feed_stock_list():
    try:
        user_id = session.get('user_id')
        if not user_id:
            return jsonify({'error': 'Unauthorized'}), 401

        conn   = get_db()
        if not conn:
            return jsonify({'error': 'Database connection failed'}), 500
        cursor = conn.cursor(dictionary=True)

        cursor.execute("""
            SELECT id, feed_name, quantity, cost_per_kg
            FROM feed_stock WHERE user_id = %s ORDER BY feed_name
        """, (user_id,))
        feed_list = cursor.fetchall()
        cursor.close(); conn.close()

        return jsonify({
            'stock_list': [{
                'id':          f['id'],
                'name':        f['feed_name'],
                'quantity':    float(f['quantity']),
                'cost_per_kg': float(f['cost_per_kg'])
            } for f in feed_list]
        }), 200
    except Exception as e:
        print(f"Error in get_feed_stock_list: {traceback.format_exc()}")
        return jsonify({'error': 'Internal server error', 'details': str(e)}), 500


# ════════════════════════════════════════════════════════════════
# GET FEED STOCK LIST FULL (for inventory table — includes min_quantity)
# ════════════════════════════════════════════════════════════════
@feed_bp.route('/api/feed/stock-list-full', methods=['GET'])
def get_feed_stock_list_full():
    try:
        user_id = session.get('user_id')
        if not user_id:
            return jsonify({'error': 'Unauthorized'}), 401

        conn   = get_db()
        if not conn:
            return jsonify({'error': 'Database connection failed'}), 500
        cursor = conn.cursor(dictionary=True)

        cursor.execute("""
            SELECT id, feed_name, quantity, min_quantity, cost_per_kg
            FROM feed_stock WHERE user_id = %s ORDER BY feed_name
        """, (user_id,))
        feed_list = cursor.fetchall()
        cursor.close(); conn.close()

        return jsonify({
            'success': True,
            'feeds': [{
                'id':           f['id'],
                'feed_name':    f['feed_name'],
                'quantity':     float(f['quantity']),
                'min_quantity': float(f['min_quantity']),
                'cost_per_kg':  float(f['cost_per_kg'])
            } for f in feed_list]
        }), 200
    except Exception as e:
        print(f"Error in get_feed_stock_list_full: {traceback.format_exc()}")
        return jsonify({'error': 'Internal server error', 'details': str(e)}), 500


# ════════════════════════════════════════════════════════════════
# GET CATTLE LIST
# ════════════════════════════════════════════════════════════════
@feed_bp.route('/api/feed/cattle-list', methods=['GET'])
def get_cattle_list():
    try:
        user_id = session.get('user_id')
        if not user_id:
            return jsonify({'error': 'Unauthorized'}), 401

        conn   = get_db()
        if not conn:
            return jsonify({'error': 'Database connection failed'}), 500
        cursor = conn.cursor(dictionary=True)

        cursor.execute("SELECT id, name, tag_no FROM cattle WHERE user_id = %s ORDER BY name", (user_id,))
        cattle_list = cursor.fetchall()
        cursor.close(); conn.close()

        return jsonify({'cattle_list': [{'id': c['id'], 'name': c['name'], 'tag_no': c['tag_no']} for c in cattle_list]}), 200
    except Exception as e:
        print(f"Error in get_cattle_list: {traceback.format_exc()}")
        return jsonify({'error': 'Internal server error', 'details': str(e)}), 500


# ════════════════════════════════════════════════════════════════
# ADD FEED ENTRY
# ════════════════════════════════════════════════════════════════
@feed_bp.route('/api/feed/add-entry', methods=['POST'])
def add_feed_entry():
    try:
        user_id = session.get('user_id')
        if not user_id:
            return jsonify({'error': 'Unauthorized'}), 401

        data = request.get_json()
        for field in ['date', 'feed_id', 'quantity']:
            if field not in data or not data[field]:
                return jsonify({'error': f'Missing required field: {field}'}), 400

        try:
            quantity = float(data['quantity'])
            if quantity <= 0:
                return jsonify({'error': 'Quantity must be greater than 0'}), 400
        except ValueError:
            return jsonify({'error': 'Invalid quantity'}), 400

        try:
            usage_date = datetime.strptime(data['date'], '%Y-%m-%d').date()
        except ValueError:
            return jsonify({'error': 'Invalid date format. Use YYYY-MM-DD'}), 400

        cattle_id = data.get('cattle_id')
        if cattle_id in ('', 'null', None):
            cattle_id = None

        conn   = get_db()
        if not conn:
            return jsonify({'error': 'Database connection failed'}), 500
        cursor = conn.cursor()

        cursor.execute("SELECT quantity FROM feed_stock WHERE id = %s AND user_id = %s", (data['feed_id'], user_id))
        stock = cursor.fetchone()
        if not stock:
            cursor.close(); conn.close()
            return jsonify({'error': 'Feed stock not found'}), 404

        if float(stock[0]) < quantity:
            cursor.close(); conn.close()
            return jsonify({'error': f'Insufficient stock. Available: {stock[0]} kg'}), 400

        cursor.execute("""
            INSERT INTO feed_usage (user_id, feed_id, cattle_id, quantity_used, usage_date)
            VALUES (%s, %s, %s, %s, %s)
        """, (user_id, data['feed_id'], cattle_id, quantity, usage_date))

        cursor.execute("""
            UPDATE feed_stock SET quantity = quantity - %s WHERE id = %s AND user_id = %s
        """, (quantity, data['feed_id'], user_id))

        conn.commit()
        entry_id = cursor.lastrowid
        cursor.close(); conn.close()

        return jsonify({'message': 'Feed entry added successfully', 'entry_id': entry_id}), 201
    except Exception as e:
        print(f"Error in add_feed_entry: {traceback.format_exc()}")
        return jsonify({'error': 'Internal server error', 'details': str(e)}), 500


# ════════════════════════════════════════════════════════════════
# ADD FEED STOCK  — also logs to expenses automatically
# ════════════════════════════════════════════════════════════════
@feed_bp.route('/api/feed/add-stock', methods=['POST'])
def add_feed_stock():
    try:
        user_id = session.get('user_id')
        if not user_id:
            return jsonify({'error': 'Unauthorized'}), 401

        data = request.get_json()

        for field in ['feed_name', 'quantity', 'min_quantity', 'cost_per_kg']:
            if field not in data or data[field] == '':
                return jsonify({'error': f'Missing required field: {field}'}), 400

        try:
            quantity     = float(data['quantity'])
            min_quantity = float(data['min_quantity'])
            cost_per_kg  = float(data['cost_per_kg'])
            if quantity < 0 or min_quantity < 0 or cost_per_kg < 0:
                return jsonify({'error': 'Values cannot be negative'}), 400
        except ValueError:
            return jsonify({'error': 'Invalid numeric values'}), 400

        conn   = get_db()
        if not conn:
            return jsonify({'error': 'Database connection failed'}), 500
        cursor = conn.cursor()

        cursor.execute("SELECT id FROM feed_stock WHERE user_id = %s AND feed_name = %s", (user_id, data['feed_name']))
        existing_feed  = cursor.fetchone()
        is_refill      = data.get('is_refill', False)
        refill_feed_id = data.get('refill_feed_id')

        if is_refill and refill_feed_id:
            cursor.execute("""
                UPDATE feed_stock SET quantity = quantity + %s, cost_per_kg = %s
                WHERE id = %s AND user_id = %s
            """, (quantity, cost_per_kg, refill_feed_id, user_id))
            message  = f'Feed stock refilled: Added {quantity} kg'
            stock_id = refill_feed_id
        elif existing_feed:
            cursor.execute("""
                UPDATE feed_stock SET quantity = quantity + %s, min_quantity = %s, cost_per_kg = %s
                WHERE id = %s AND user_id = %s
            """, (quantity, min_quantity, cost_per_kg, existing_feed[0], user_id))
            message  = f'Feed stock updated: Added {quantity} kg to existing stock'
            stock_id = existing_feed[0]
        else:
            cursor.execute("""
                INSERT INTO feed_stock (user_id, feed_name, quantity, min_quantity, cost_per_kg)
                VALUES (%s, %s, %s, %s, %s)
            """, (user_id, data['feed_name'], quantity, min_quantity, cost_per_kg))
            message  = 'Feed stock added successfully'
            stock_id = cursor.lastrowid

        # ── Auto-log expense ──────────────────────────────────
        total_cost  = quantity * cost_per_kg
        today_str   = datetime.now().strftime('%Y-%m-%d')
        description = f'Feed Stock Purchase - {data["feed_name"]} ({quantity} kg)'
        cursor.execute("""
            INSERT INTO expenses (user_id, date, category, description, amount)
            VALUES (%s, %s, 'Feed', %s, %s)
        """, (user_id, today_str, description, round(total_cost, 2)))

        conn.commit()
        cursor.close(); conn.close()

        return jsonify({'message': message, 'stock_id': stock_id}), 201
    except Exception as e:
        print(f"Error in add_feed_stock: {traceback.format_exc()}")
        return jsonify({'error': 'Internal server error', 'details': str(e)}), 500


# ════════════════════════════════════════════════════════════════
# DELETE FEED STOCK — also removes matching expense entries
# ════════════════════════════════════════════════════════════════
@feed_bp.route('/api/feed/delete-stock/<int:stock_id>', methods=['DELETE'])
def delete_feed_stock(stock_id):
    try:
        user_id = session.get('user_id')
        if not user_id:
            return jsonify({'error': 'Unauthorized'}), 401

        conn   = get_db()
        if not conn:
            return jsonify({'error': 'Database connection failed'}), 500
        cursor = conn.cursor(dictionary=True)

        # Fetch stock to confirm ownership and get feed name
        cursor.execute("SELECT feed_name FROM feed_stock WHERE id = %s AND user_id = %s", (stock_id, user_id))
        stock = cursor.fetchone()
        if not stock:
            cursor.close(); conn.close()
            return jsonify({'error': 'Feed stock not found'}), 404

        feed_name = stock['feed_name']

        # Delete related feed_usage rows
        cursor.execute("DELETE FROM feed_usage WHERE feed_id = %s AND user_id = %s", (stock_id, user_id))

        # Delete matching expense entries (those auto-logged on stock add/refill)
        cursor.execute("""
            DELETE FROM expenses
            WHERE user_id = %s AND category = 'Feed'
            AND description LIKE %s
        """, (user_id, f'Feed Stock Purchase - {feed_name} (%'))

        # Delete the stock itself
        cursor.execute("DELETE FROM feed_stock WHERE id = %s AND user_id = %s", (stock_id, user_id))

        conn.commit()
        cursor.close(); conn.close()

        return jsonify({'message': f'"{feed_name}" stock deleted successfully'}), 200
    except Exception as e:
        print(f"Error in delete_feed_stock: {traceback.format_exc()}")
        return jsonify({'error': 'Internal server error', 'details': str(e)}), 500


# ════════════════════════════════════════════════════════════════
# GET REPORT DATA
# ════════════════════════════════════════════════════════════════
@feed_bp.route('/api/feed/report-data', methods=['GET'])
def get_feed_report_data():
    try:
        user_id = session.get('user_id')
        if not user_id:
            return jsonify({'error': 'Unauthorized'}), 401

        from_date = request.args.get('from_date')
        to_date   = request.args.get('to_date')
        if not from_date or not to_date:
            return jsonify({'error': 'Date range required'}), 400

        conn   = get_db()
        if not conn:
            return jsonify({'error': 'Database connection failed'}), 500
        cursor = conn.cursor(dictionary=True)

        cursor.execute("""
            SELECT fu.usage_date as date, c.name as cattle_name, fs.feed_name as feed_type,
                   fu.quantity_used as quantity, fs.cost_per_kg,
                   (fu.quantity_used * fs.cost_per_kg) as cost
            FROM feed_usage fu
            JOIN feed_stock fs ON fu.feed_id = fs.id
            LEFT JOIN cattle c ON fu.cattle_id = c.id
            WHERE fu.user_id = %s AND fu.usage_date BETWEEN %s AND %s
            ORDER BY fu.usage_date DESC
        """, (user_id, from_date, to_date))
        history_records = cursor.fetchall()

        cursor.execute("""
            SELECT fs.feed_name, SUM(fu.quantity_used) as total_quantity,
                   SUM(fu.quantity_used * fs.cost_per_kg) as total_cost
            FROM feed_usage fu
            JOIN feed_stock fs ON fu.feed_id = fs.id
            WHERE fu.user_id = %s AND fu.usage_date BETWEEN %s AND %s
            GROUP BY fs.feed_name
        """, (user_id, from_date, to_date))
        breakdown_data = cursor.fetchall()

        cursor.close(); conn.close()

        total_quantity = sum(float(r['quantity']) for r in history_records)
        total_cost     = sum(float(r['cost'])     for r in history_records)

        return jsonify({
            'history': [{
                'date':        r['date'].strftime('%Y-%m-%d'),
                'cattle_name': r['cattle_name'] or 'General Stock',
                'feed_type':   r['feed_type'],
                'quantity':    float(r['quantity']),
                'cost_per_kg': float(r['cost_per_kg']),
                'cost':        float(r['cost'])
            } for r in history_records],
            'breakdown': [{
                'feed_name': r['feed_name'],
                'quantity':  float(r['total_quantity']),
                'cost':      float(r['total_cost'])
            } for r in breakdown_data],
            'summary': {
                'total_quantity': round(total_quantity, 2),
                'total_cost':     round(total_cost, 2),
                'record_count':   len(history_records)
            },
            'date_range': {'from': from_date, 'to': to_date}
        }), 200
    except Exception as e:
        print(f"Error in get_feed_report_data: {traceback.format_exc()}")
        return jsonify({'error': 'Internal server error', 'details': str(e)}), 500