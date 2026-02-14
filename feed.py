from flask import Blueprint, request, jsonify, session,render_template
from datetime import datetime, timedelta
from decimal import Decimal
import traceback
from db import get_db
feed_bp = Blueprint('feed', __name__)


@feed_bp.route('/feed')
def feed():
    return render_template('feed.html')
# ════════════════════════════════════════════════════════════════
# GET FEED METRICS
# ════════════════════════════════════════════════════════════════
@feed_bp.route('/api/feed/metrics', methods=['GET'])
def get_feed_metrics():
    """Get feed usage metrics: total used, total cost, average per cattle, low stock alerts"""
    try:
        user_id = session.get('user_id')
        if not user_id:
            return jsonify({'error': 'Unauthorized'}), 401
        
        from_date = request.args.get('from_date')
        to_date = request.args.get('to_date')
        
        if not from_date or not to_date:
            today = datetime.now()
            from_date = today.replace(day=1).strftime('%Y-%m-%d')
            to_date = today.strftime('%Y-%m-%d')
        
        conn = get_db()
        if not conn:
            return jsonify({'error': 'Database connection failed'}), 500
        
        cursor = conn.cursor(dictionary=True)
        
        # Total feed used (kg)
        cursor.execute("""
            SELECT COALESCE(SUM(fu.quantity_used), 0) as total_used
            FROM feed_usage fu
            WHERE fu.user_id = %s AND fu.usage_date BETWEEN %s AND %s
        """, (user_id, from_date, to_date))
        usage_data = cursor.fetchone()
        total_feed_used = float(usage_data['total_used']) if usage_data else 0.0
        
        # Total feed cost
        cursor.execute("""
            SELECT COALESCE(SUM(fu.quantity_used * fs.cost_per_kg), 0) as total_cost
            FROM feed_usage fu
            JOIN feed_stock fs ON fu.feed_id = fs.id
            WHERE fu.user_id = %s AND fu.usage_date BETWEEN %s AND %s
        """, (user_id, from_date, to_date))
        cost_data = cursor.fetchone()
        total_feed_cost = float(cost_data['total_cost']) if cost_data else 0.0
        
        # Average feed per cattle
        cursor.execute("""
            SELECT COUNT(DISTINCT cattle_id) as cattle_count
            FROM feed_usage
            WHERE user_id = %s AND usage_date BETWEEN %s AND %s AND cattle_id IS NOT NULL
        """, (user_id, from_date, to_date))
        cattle_data = cursor.fetchone()
        cattle_count = cattle_data['cattle_count'] if cattle_data else 0
        avg_per_cattle = (total_feed_used / cattle_count) if cattle_count > 0 else 0.0
        
        # Low stock alerts
        cursor.execute("""
            SELECT COUNT(*) as low_stock_count
            FROM feed_stock
            WHERE user_id = %s AND quantity <= min_quantity
        """, (user_id,))
        stock_data = cursor.fetchone()
        low_stock_alerts = stock_data['low_stock_count'] if stock_data else 0
        
        cursor.close()
        conn.close()
        
        return jsonify({
            'total_feed_used': round(total_feed_used, 2),
            'total_feed_cost': round(total_feed_cost, 2),
            'avg_per_cattle': round(avg_per_cattle, 2),
            'low_stock_alerts': low_stock_alerts,
            'date_range': {
                'from': from_date,
                'to': to_date
            }
        }), 200
        
    except Exception as e:
        print(f"Error in get_feed_metrics: {traceback.format_exc()}")
        return jsonify({'error': 'Internal server error', 'details': str(e)}), 500


# ════════════════════════════════════════════════════════════════
# GET FEED USAGE TIMELINE (for bar chart)
# ════════════════════════════════════════════════════════════════
@feed_bp.route('/api/feed/usage-timeline', methods=['GET'])
def get_feed_usage_timeline():
    """Get feed usage grouped by date for bar chart"""
    try:
        user_id = session.get('user_id')
        if not user_id:
            return jsonify({'error': 'Unauthorized'}), 401
        
        from_date = request.args.get('from_date')
        to_date = request.args.get('to_date')
        
        if not from_date or not to_date:
            today = datetime.now()
            from_date = today.replace(day=1).strftime('%Y-%m-%d')
            to_date = today.strftime('%Y-%m-%d')
        
        conn = get_db()
        if not conn:
            return jsonify({'error': 'Database connection failed'}), 500
        
        cursor = conn.cursor(dictionary=True)
        
        cursor.execute("""
            SELECT 
                usage_date as date,
                COALESCE(SUM(quantity_used), 0) as total_quantity
            FROM feed_usage
            WHERE user_id = %s AND usage_date BETWEEN %s AND %s
            GROUP BY usage_date
            ORDER BY usage_date
        """, (user_id, from_date, to_date))
        
        usage_records = cursor.fetchall()
        
        cursor.close()
        conn.close()
        
        timeline_data = [
            {
                'date': record['date'].strftime('%Y-%m-%d'),
                'quantity': float(record['total_quantity'])
            }
            for record in usage_records
        ]
        
        return jsonify({
            'timeline': timeline_data,
            'date_range': {
                'from': from_date,
                'to': to_date
            }
        }), 200
        
    except Exception as e:
        print(f"Error in get_feed_usage_timeline: {traceback.format_exc()}")
        return jsonify({'error': 'Internal server error', 'details': str(e)}), 500


# ════════════════════════════════════════════════════════════════
# GET FEED TYPE DISTRIBUTION (for pie chart)
# ════════════════════════════════════════════════════════════════
@feed_bp.route('/api/feed/type-distribution', methods=['GET'])
def get_feed_type_distribution():
    """Get feed usage by feed type for pie chart"""
    try:
        user_id = session.get('user_id')
        if not user_id:
            return jsonify({'error': 'Unauthorized'}), 401
        
        from_date = request.args.get('from_date')
        to_date = request.args.get('to_date')
        
        if not from_date or not to_date:
            today = datetime.now()
            from_date = today.replace(day=1).strftime('%Y-%m-%d')
            to_date = today.strftime('%Y-%m-%d')
        
        conn = get_db()
        if not conn:
            return jsonify({'error': 'Database connection failed'}), 500
        
        cursor = conn.cursor(dictionary=True)
        
        cursor.execute("""
            SELECT 
                fs.feed_name,
                COALESCE(SUM(fu.quantity_used), 0) as total_quantity
            FROM feed_usage fu
            JOIN feed_stock fs ON fu.feed_id = fs.id
            WHERE fu.user_id = %s AND fu.usage_date BETWEEN %s AND %s
            GROUP BY fs.id, fs.feed_name
            HAVING total_quantity > 0
            ORDER BY total_quantity DESC
        """, (user_id, from_date, to_date))
        
        distribution_data = cursor.fetchall()
        
        cursor.close()
        conn.close()
        
        distribution = [
            {
                'label': record['feed_name'],
                'value': float(record['total_quantity'])
            }
            for record in distribution_data
        ]
        
        return jsonify({
            'distribution': distribution,
            'date_range': {
                'from': from_date,
                'to': to_date
            }
        }), 200
        
    except Exception as e:
        print(f"Error in get_feed_type_distribution: {traceback.format_exc()}")
        return jsonify({'error': 'Internal server error', 'details': str(e)}), 500


# ════════════════════════════════════════════════════════════════
# GET FEED HISTORY (with pagination and filtering)
# ════════════════════════════════════════════════════════════════
@feed_bp.route('/api/feed/history', methods=['GET'])
def get_feed_history():
    """Get feed usage history with pagination and filtering"""
    try:
        user_id = session.get('user_id')
        if not user_id:
            return jsonify({'error': 'Unauthorized'}), 401
        
        page = int(request.args.get('page', 1))
        per_page = int(request.args.get('per_page', 10))
        feed_type_filter = request.args.get('feed_type', 'all')
        cattle_filter = request.args.get('cattle', 'all')
        from_date = request.args.get('from_date')
        to_date = request.args.get('to_date')
        
        if not from_date or not to_date:
            today = datetime.now()
            from_date = today.replace(day=1).strftime('%Y-%m-%d')
            to_date = today.strftime('%Y-%m-%d')
        
        conn = get_db()
        if not conn:
            return jsonify({'error': 'Database connection failed'}), 500
        
        cursor = conn.cursor(dictionary=True)
        
        # Build query with filters
        query = """
            SELECT 
                fu.usage_date as date,
                c.name as cattle_name,
                fs.feed_name as feed_type,
                fu.quantity_used as quantity,
                fs.cost_per_kg,
                (fu.quantity_used * fs.cost_per_kg) as cost,
                fu.id
            FROM feed_usage fu
            JOIN feed_stock fs ON fu.feed_id = fs.id
            LEFT JOIN cattle c ON fu.cattle_id = c.id
            WHERE fu.user_id = %s AND fu.usage_date BETWEEN %s AND %s
        """
        params = [user_id, from_date, to_date]
        
        if feed_type_filter != 'all':
            query += " AND fs.feed_name = %s"
            params.append(feed_type_filter)
        
        if cattle_filter != 'all':
            query += " AND c.name = %s"
            params.append(cattle_filter)
        
        query += " ORDER BY fu.usage_date DESC"
        
        cursor.execute(query, params)
        all_records = cursor.fetchall()
        
        total_records = len(all_records)
        
        # Apply pagination
        start_idx = (page - 1) * per_page
        end_idx = start_idx + per_page
        paginated_records = all_records[start_idx:end_idx]
        
        history = [
            {
                'date': record['date'].strftime('%Y-%m-%d'),
                'cattle_name': record['cattle_name'] or 'General Stock',
                'feed_type': record['feed_type'],
                'quantity': float(record['quantity']),
                'cost': float(record['cost']),
                'cost_per_kg': float(record['cost_per_kg'])
            }
            for record in paginated_records
        ]
        
        cursor.close()
        conn.close()
        
        return jsonify({
            'history': history,
            'pagination': {
                'page': page,
                'per_page': per_page,
                'total': total_records,
                'total_pages': (total_records + per_page - 1) // per_page
            },
            'date_range': {
                'from': from_date,
                'to': to_date
            }
        }), 200
        
    except Exception as e:
        print(f"Error in get_feed_history: {traceback.format_exc()}")
        return jsonify({'error': 'Internal server error', 'details': str(e)}), 500


# ════════════════════════════════════════════════════════════════
# GET FEED STOCK LIST (for dropdown)
# ════════════════════════════════════════════════════════════════
@feed_bp.route('/api/feed/stock-list', methods=['GET'])
def get_feed_stock_list():
    """Get list of available feed stock"""
    try:
        user_id = session.get('user_id')
        if not user_id:
            return jsonify({'error': 'Unauthorized'}), 401
        
        conn = get_db()
        if not conn:
            return jsonify({'error': 'Database connection failed'}), 500
        
        cursor = conn.cursor(dictionary=True)
        
        cursor.execute("""
            SELECT id, feed_name, quantity, cost_per_kg
            FROM feed_stock
            WHERE user_id = %s
            ORDER BY feed_name
        """, (user_id,))
        
        feed_list = cursor.fetchall()
        
        cursor.close()
        conn.close()
        
        stock_list = [
            {
                'id': feed['id'],
                'name': feed['feed_name'],
                'quantity': float(feed['quantity']),
                'cost_per_kg': float(feed['cost_per_kg'])
            }
            for feed in feed_list
        ]
        
        return jsonify({'stock_list': stock_list}), 200
        
    except Exception as e:
        print(f"Error in get_feed_stock_list: {traceback.format_exc()}")
        return jsonify({'error': 'Internal server error', 'details': str(e)}), 500


# ════════════════════════════════════════════════════════════════
# GET CATTLE LIST (for dropdown)
# ════════════════════════════════════════════════════════════════
@feed_bp.route('/api/feed/cattle-list', methods=['GET'])
def get_cattle_list():
    """Get list of cattle for dropdown"""
    try:
        user_id = session.get('user_id')
        if not user_id:
            return jsonify({'error': 'Unauthorized'}), 401
        
        conn = get_db()
        if not conn:
            return jsonify({'error': 'Database connection failed'}), 500
        
        cursor = conn.cursor(dictionary=True)
        
        cursor.execute("""
            SELECT id, name, tag_no
            FROM cattle
            WHERE user_id = %s
            ORDER BY name
        """, (user_id,))
        
        cattle_list = cursor.fetchall()
        
        cursor.close()
        conn.close()
        
        cattle = [
            {
                'id': c['id'],
                'name': c['name'],
                'tag_no': c['tag_no']
            }
            for c in cattle_list
        ]
        
        return jsonify({'cattle_list': cattle}), 200
        
    except Exception as e:
        print(f"Error in get_cattle_list: {traceback.format_exc()}")
        return jsonify({'error': 'Internal server error', 'details': str(e)}), 500


# ════════════════════════════════════════════════════════════════
# ADD FEED ENTRY
# ════════════════════════════════════════════════════════════════
@feed_bp.route('/api/feed/add-entry', methods=['POST'])
def add_feed_entry():
    """Add a new feed usage entry"""
    try:
        user_id = session.get('user_id')
        if not user_id:
            return jsonify({'error': 'Unauthorized'}), 401
        
        data = request.get_json()
        
        # Validate required fields
        required_fields = ['date', 'feed_id', 'quantity']
        for field in required_fields:
            if field not in data or not data[field]:
                return jsonify({'error': f'Missing required field: {field}'}), 400
        
        # Validate quantity
        try:
            quantity = float(data['quantity'])
            if quantity <= 0:
                return jsonify({'error': 'Quantity must be greater than 0'}), 400
        except ValueError:
            return jsonify({'error': 'Invalid quantity'}), 400
        
        # Validate date format
        try:
            usage_date = datetime.strptime(data['date'], '%Y-%m-%d').date()
        except ValueError:
            return jsonify({'error': 'Invalid date format. Use YYYY-MM-DD'}), 400
        
        cattle_id = data.get('cattle_id')
        if cattle_id == '' or cattle_id == 'null':
            cattle_id = None
        
        conn = get_db()
        if not conn:
            return jsonify({'error': 'Database connection failed'}), 500
        
        cursor = conn.cursor()
        
        # Check if feed stock exists and has enough quantity
        cursor.execute("""
            SELECT quantity FROM feed_stock
            WHERE id = %s AND user_id = %s
        """, (data['feed_id'], user_id))
        
        stock_data = cursor.fetchone()
        if not stock_data:
            cursor.close()
            conn.close()
            return jsonify({'error': 'Feed stock not found'}), 404
        
        current_stock = float(stock_data[0])
        if current_stock < quantity:
            cursor.close()
            conn.close()
            return jsonify({'error': f'Insufficient stock. Available: {current_stock} kg'}), 400
        
        # Insert feed usage
        cursor.execute("""
            INSERT INTO feed_usage (user_id, feed_id, cattle_id, quantity_used, usage_date)
            VALUES (%s, %s, %s, %s, %s)
        """, (user_id, data['feed_id'], cattle_id, quantity, usage_date))
        
        # Update feed stock quantity
        cursor.execute("""
            UPDATE feed_stock
            SET quantity = quantity - %s
            WHERE id = %s AND user_id = %s
        """, (quantity, data['feed_id'], user_id))
        
        conn.commit()
        feed_entry_id = cursor.lastrowid
        
        cursor.close()
        conn.close()
        
        return jsonify({
            'message': 'Feed entry added successfully',
            'entry_id': feed_entry_id
        }), 201
        
    except Exception as e:
        print(f"Error in add_feed_entry: {traceback.format_exc()}")
        return jsonify({'error': 'Internal server error', 'details': str(e)}), 500


# ════════════════════════════════════════════════════════════════
# ADD FEED STOCK
# ════════════════════════════════════════════════════════════════
@feed_bp.route('/api/feed/add-stock', methods=['POST'])
def add_feed_stock():
    """Add new feed stock"""
    try:
        user_id = session.get('user_id')
        if not user_id:
            return jsonify({'error': 'Unauthorized'}), 401
        
        data = request.get_json()
        
        # Validate required fields
        required_fields = ['feed_name', 'quantity', 'min_quantity', 'cost_per_kg']
        for field in required_fields:
            if field not in data or data[field] == '':
                return jsonify({'error': f'Missing required field: {field}'}), 400
        
        # Validate numeric fields
        try:
            quantity = float(data['quantity'])
            min_quantity = float(data['min_quantity'])
            cost_per_kg = float(data['cost_per_kg'])
            total_cost = quantity * cost_per_kg

            if quantity < 0 or min_quantity < 0 or cost_per_kg < 0:
                return jsonify({'error': 'Values cannot be negative'}), 400
                
        except ValueError:
            return jsonify({'error': 'Invalid numeric values'}), 400
        
        conn = get_db()
        if not conn:
            return jsonify({'error': 'Database connection failed'}), 500
        
        cursor = conn.cursor()
        
        # Check if feed name already exists for this user
        cursor.execute("""
            SELECT id FROM feed_stock
            WHERE user_id = %s AND feed_name = %s
        """, (user_id, data['feed_name']))
        
        existing_feed = cursor.fetchone()
        
        if existing_feed:
            # Update existing stock
            cursor.execute("""
                UPDATE feed_stock
                SET quantity = quantity + %s,
                    min_quantity = %s,
                    cost_per_kg = %s
                WHERE id = %s AND user_id = %s
            """, (quantity, min_quantity, cost_per_kg, existing_feed[0], user_id))
            
            message = f'Feed stock updated: Added {quantity} kg to existing stock'
        else:
            # Insert new feed stock
            cursor.execute("""
                INSERT INTO feed_stock (user_id, feed_name, quantity, min_quantity, cost_per_kg)
                VALUES (%s, %s, %s, %s, %s)
            """, (user_id, data['feed_name'], quantity, min_quantity, cost_per_kg))
            
            message = 'Feed stock added successfully'
        
        # Insert expense record for feed purchase
        expense_description = f"Feed Stock Purchase - {data['feed_name']} ({quantity} kg)"

        cursor.execute("""
            INSERT INTO expenses (user_id, date, category, description, amount, created_at)
            VALUES (%s, %s, %s, %s, %s, NOW())
        """, (
            user_id,
            datetime.now().strftime('%Y-%m-%d'),
            "Feed",
            expense_description,
            total_cost
        ))

        conn.commit()
        stock_id = cursor.lastrowid if not existing_feed else existing_feed[0]
        
        cursor.close()
        conn.close()
        
        return jsonify({
            'message': message,
            'stock_id': stock_id
        }), 201
        
    except Exception as e:
        print(f"Error in add_feed_stock: {traceback.format_exc()}")
        return jsonify({'error': 'Internal server error', 'details': str(e)}), 500


# ════════════════════════════════════════════════════════════════
# GET REPORT DATA
# ════════════════════════════════════════════════════════════════
@feed_bp.route('/api/feed/report-data', methods=['GET'])
def get_feed_report_data():
    """Get comprehensive feed data for PDF report"""
    try:
        user_id = session.get('user_id')
        if not user_id:
            return jsonify({'error': 'Unauthorized'}), 401
        
        from_date = request.args.get('from_date')
        to_date = request.args.get('to_date')
        
        if not from_date or not to_date:
            return jsonify({'error': 'Date range required'}), 400
        
        conn = get_db()
        if not conn:
            return jsonify({'error': 'Database connection failed'}), 500
        
        cursor = conn.cursor(dictionary=True)
        
        # Get detailed feed history
        cursor.execute("""
            SELECT 
                fu.usage_date as date,
                c.name as cattle_name,
                fs.feed_name as feed_type,
                fu.quantity_used as quantity,
                fs.cost_per_kg,
                (fu.quantity_used * fs.cost_per_kg) as cost
            FROM feed_usage fu
            JOIN feed_stock fs ON fu.feed_id = fs.id
            LEFT JOIN cattle c ON fu.cattle_id = c.id
            WHERE fu.user_id = %s AND fu.usage_date BETWEEN %s AND %s
            ORDER BY fu.usage_date DESC
        """, (user_id, from_date, to_date))
        
        history_records = cursor.fetchall()
        
        # Calculate summary
        total_quantity = sum(float(record['quantity']) for record in history_records)
        total_cost = sum(float(record['cost']) for record in history_records)
        
        # Get feed type breakdown
        cursor.execute("""
            SELECT 
                fs.feed_name,
                SUM(fu.quantity_used) as total_quantity,
                SUM(fu.quantity_used * fs.cost_per_kg) as total_cost
            FROM feed_usage fu
            JOIN feed_stock fs ON fu.feed_id = fs.id
            WHERE fu.user_id = %s AND fu.usage_date BETWEEN %s AND %s
            GROUP BY fs.feed_name
        """, (user_id, from_date, to_date))
        
        breakdown_data = cursor.fetchall()
        
        cursor.close()
        conn.close()
        
        # Format data
        formatted_history = [
            {
                'date': record['date'].strftime('%Y-%m-%d'),
                'cattle_name': record['cattle_name'] or 'General Stock',
                'feed_type': record['feed_type'],
                'quantity': float(record['quantity']),
                'cost_per_kg': float(record['cost_per_kg']),
                'cost': float(record['cost'])
            }
            for record in history_records
        ]
        
        formatted_breakdown = [
            {
                'feed_name': record['feed_name'],
                'quantity': float(record['total_quantity']),
                'cost': float(record['total_cost'])
            }
            for record in breakdown_data
        ]
        
        return jsonify({
            'history': formatted_history,
            'breakdown': formatted_breakdown,
            'summary': {
                'total_quantity': round(total_quantity, 2),
                'total_cost': round(total_cost, 2),
                'record_count': len(formatted_history)
            },
            'date_range': {
                'from': from_date,
                'to': to_date
            }
        }), 200
        
    except Exception as e:
        print(f"Error in get_feed_report_data: {traceback.format_exc()}")
        return jsonify({'error': 'Internal server error', 'details': str(e)}), 500

@feed_bp.route('/feed/stock-list')
def feed_stock_list():
    user_id = session.get('user_id')
    if not user_id:
        return jsonify({'success': False, 'error': 'Not authenticated'}), 401

    conn = get_db()
    cur  = conn.cursor(dictionary=True)
    try:
        cur.execute("""
            SELECT id, feed_name, quantity, min_quantity, cost_per_kg
            FROM feed_stock
            WHERE user_id = %s
            ORDER BY feed_name ASC
        """, (user_id,))
        feeds = cur.fetchall()
        # Convert decimals to float for JSON
        for f in feeds:
            f['quantity']     = float(f['quantity']     or 0)
            f['min_quantity'] = float(f['min_quantity'] or 0)
            f['cost_per_kg']  = float(f['cost_per_kg']  or 0)
        return jsonify({'success': True, 'feeds': feeds})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500
    finally:
        cur.close()
        conn.close()


# ─────────────────────────────────────────────
# POST /feed/add-usage   (generic, optional)
# Still useful for non-cattle-specific feed usage entries
# (e.g. general stock deductions from the Feed page itself).
# The cattle_detail page uses /cattle/<id>/add-feed instead.
# ─────────────────────────────────────────────
@feed_bp.route('/feed/add-usage', methods=['POST'])
def add_feed_usage():
    user_id = session.get('user_id')
    if not user_id:
        return jsonify({'success': False, 'error': 'Not authenticated'}), 401

    try:
        data       = request.get_json()
        feed_id    = int(data.get('feed_id'))
        qty        = float(data.get('quantity_used', 0))
        usage_date = data.get('usage_date')
        cattle_id  = data.get('cattle_id')   # None for general stock usage

        conn = get_db()
        cur  = conn.cursor(dictionary=True)

        # Check stock availability
        cur.execute("SELECT id, quantity FROM feed_stock WHERE id=%s AND user_id=%s", (feed_id, user_id))
        feed = cur.fetchone()
        if not feed:
            return jsonify({'success': False, 'error': 'Feed not found'}), 404
        if float(feed['quantity']) < qty:
            return jsonify({'success': False, 'error': f'Insufficient stock. Available: {float(feed["quantity"]):.1f} kg'}), 400

        cur2 = conn.cursor()
        cur2.execute("""
            INSERT INTO feed_usage (user_id, feed_id, cattle_id, quantity_used, usage_date)
            VALUES (%s, %s, %s, %s, %s)
        """, (user_id, feed_id, cattle_id, qty, usage_date))

        # Deduct from stock
        cur2.execute(
            "UPDATE feed_stock SET quantity = quantity - %s WHERE id=%s AND user_id=%s",
            (qty, feed_id, user_id)
        )
        conn.commit()
        return jsonify({'success': True, 'message': 'Feed usage recorded'})

    except Exception as e:
        if 'conn' in locals():
            conn.rollback()
        return jsonify({'success': False, 'error': str(e)}), 500
    finally:
        if 'cur'  in locals(): cur.close()
        if 'cur2' in locals(): cur2.close()
        if 'conn' in locals(): conn.close()
