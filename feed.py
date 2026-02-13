from flask import Blueprint, render_template, request, jsonify, session, redirect, url_for
from datetime import datetime, timedelta
from db import get_db

feed_bp = Blueprint('feed', __name__)

@feed_bp.route('/feed')
def feed_page():
    if 'user_id' not in session:
        return redirect(url_for('auth.login'))
    user_name = session.get('full_name', 'User')
    return render_template('feed.html', user_name=user_name)

@feed_bp.route('/feed/inventory')
def get_inventory():
    user_id = session.get('user_id')
    connection = get_db()
    cursor = connection.cursor(dictionary=True)
    
    try:
        cursor.execute("""
            SELECT fs.*, 
                   COALESCE(
                       (SELECT AVG(fu.quantity_used) 
                        FROM feed_usage fu 
                        WHERE fu.feed_id = fs.id 
                        AND fu.usage_date >= DATE_SUB(NOW(), INTERVAL 30 DAY)
                       ), 0
                   ) as avg_daily_usage,
                   COALESCE(
                       (SELECT SUM(fu.quantity_used) 
                        FROM feed_usage fu 
                        WHERE fu.feed_id = fs.id 
                        AND fu.usage_date >= DATE_SUB(NOW(), INTERVAL 7 DAY)
                       ), 0
                   ) as weekly_usage
            FROM feed_stock fs
            WHERE fs.user_id = %s
            ORDER BY fs.feed_name
        """, (user_id,))
        
        inventory = cursor.fetchall()
        
        for item in inventory:
            if item['min_quantity'] and item['min_quantity'] > 0:
                item['stock_percentage'] = round((item['quantity'] / item['min_quantity'] * 100), 2)
            else:
                item['stock_percentage'] = 100
                
            if item['avg_daily_usage'] and item['avg_daily_usage'] > 0:
                item['days_remaining'] = round(item['quantity'] / item['avg_daily_usage'])
            else:
                item['days_remaining'] = 999
                
            item['is_low'] = item['quantity'] <= item['min_quantity']
            
            if isinstance(item.get('updated_at'), datetime):
                item['updated_at'] = item['updated_at'].strftime('%Y-%m-%d %H:%M:%S')
        
        cursor.close()
        connection.close()
        
        return jsonify({'success': True, 'inventory': inventory})
    
    except Exception as e:
        if 'cursor' in locals():
            cursor.close()
            connection.close()
        return jsonify({'success': False, 'error': str(e)}), 500

@feed_bp.route('/feed/usage')
def get_usage():
    user_id = session.get('user_id')
    page = request.args.get('page', 1, type=int)
    per_page = request.args.get('per_page', 10, type=int)
    
    connection = get_db()
    cursor = connection.cursor(dictionary=True)
    
    try:
        count_query = """
            SELECT COUNT(*) as total
            FROM feed_usage fu
            WHERE fu.user_id = %s
        """
        cursor.execute(count_query, (user_id,))
        total = cursor.fetchone()['total']
        
        cursor.execute("""
            SELECT fu.*, 
                   fs.feed_name, 
                   c.name as cattle_name, 
                   c.tag_no,
                   DATE_FORMAT(fu.usage_date, '%%H:%%i') as scheduled_time
            FROM feed_usage fu
            LEFT JOIN feed_stock fs ON fu.feed_id = fs.id
            LEFT JOIN cattle c ON fu.cattle_id = c.id
            WHERE fu.user_id = %s
            ORDER BY fu.usage_date DESC, fu.created_at DESC
            LIMIT %s OFFSET %s
        """, (user_id, per_page, (page - 1) * per_page))
        
        usage = cursor.fetchall()
        
        for item in usage:
            if isinstance(item.get('usage_date'), datetime):
                item['usage_date_str'] = item['usage_date'].strftime('%Y-%m-%d')
                item['usage_time'] = item['usage_date'].strftime('%I:%M %p')
                item['is_today'] = item['usage_date'].date() == datetime.now().date()
                item['is_past'] = item['usage_date'] < datetime.now()
                
                if item['is_past']:
                    item['status'] = 'Completed'
                elif item['is_today']:
                    item['status'] = 'In Progress'
                else:
                    item['status'] = 'Pending'
            else:
                item['usage_date_str'] = str(item.get('usage_date', ''))
                item['usage_time'] = 'N/A'
                item['status'] = 'Pending'
                
            if isinstance(item.get('created_at'), datetime):
                item['created_at'] = item['created_at'].strftime('%Y-%m-%d %H:%M:%S')
        
        cursor.close()
        connection.close()
        
        return jsonify({
            'success': True,
            'usage': usage,
            'total': total,
            'page': page,
            'per_page': per_page,
            'total_pages': (total + per_page - 1) // per_page if total > 0 else 0
        })
    
    except Exception as e:
        if 'cursor' in locals():
            cursor.close()
            connection.close()
        return jsonify({'success': False, 'error': str(e)}), 500

@feed_bp.route('/feed/add-stock', methods=['POST'])
def add_stock():
    user_id = session.get('user_id')
    
    try:
        data = request.get_json()
        
        feed_name = data.get('feed_name')
        quantity = float(data.get('quantity'))
        min_quantity = float(data.get('min_quantity'))
        cost_per_kg = float(data.get('cost_per_kg', 0))
        
        connection = get_db()
        cursor = connection.cursor()
        
        cursor.execute("""
            SELECT id FROM feed_stock 
            WHERE user_id = %s AND feed_name = %s
        """, (user_id, feed_name))
        
        existing = cursor.fetchone()
        
        if existing:
            cursor.execute("""
                UPDATE feed_stock 
                SET quantity = quantity + %s,
                    min_quantity = %s,
                    cost_per_kg = %s,
                    updated_at = NOW()
                WHERE id = %s AND user_id = %s
            """, (quantity, min_quantity, cost_per_kg, existing[0], user_id))
        else:
            cursor.execute("""
                INSERT INTO feed_stock (user_id, feed_name, quantity, min_quantity, cost_per_kg, updated_at)
                VALUES (%s, %s, %s, %s, %s, NOW())
            """, (user_id, feed_name, quantity, min_quantity, cost_per_kg))
        
        connection.commit()
        cursor.close()
        connection.close()
        
        return jsonify({'success': True, 'message': 'Feed stock added successfully'})
    
    except Exception as e:
        if 'connection' in locals():
            connection.rollback()
            cursor.close()
            connection.close()
        return jsonify({'success': False, 'error': str(e)}), 500

@feed_bp.route('/feed/add-usage', methods=['POST'])
def add_usage():
    user_id = session.get('user_id')
    
    try:
        data = request.get_json()
        
        feed_id = data.get('feed_id')
        cattle_id = data.get('cattle_id')
        quantity_used = float(data.get('quantity_used'))
        usage_date = data.get('usage_date')
        
        connection = get_db()
        cursor = connection.cursor()
        
        cursor.execute("""
            INSERT INTO feed_usage (user_id, feed_id, cattle_id, quantity_used, usage_date, created_at)
            VALUES (%s, %s, %s, %s, %s, NOW())
        """, (user_id, feed_id, cattle_id, quantity_used, usage_date))
        
        cursor.execute("""
            UPDATE feed_stock 
            SET quantity = quantity - %s,
                updated_at = NOW()
            WHERE id = %s AND user_id = %s
        """, (quantity_used, feed_id, user_id))
        
        connection.commit()
        cursor.close()
        connection.close()
        
        return jsonify({'success': True, 'message': 'Feed usage recorded successfully'})
    
    except Exception as e:
        if 'connection' in locals():
            connection.rollback()
            cursor.close()
            connection.close()
        return jsonify({'success': False, 'error': str(e)}), 500

@feed_bp.route('/feed/chart')
def get_chart_data():
    user_id = session.get('user_id')
    
    connection = get_db()
    cursor = connection.cursor(dictionary=True)
    
    try:
        cursor.execute("""
            SELECT DATE(usage_date) as date, SUM(quantity_used) as total
            FROM feed_usage
            WHERE user_id = %s AND usage_date >= DATE_SUB(NOW(), INTERVAL 7 DAY)
            GROUP BY DATE(usage_date)
            ORDER BY date ASC
        """, (user_id,))
        
        data = cursor.fetchall()
        
        days = []
        for i in range(6, -1, -1):
            date = (datetime.now() - timedelta(days=i)).date()
            days.append({
                'date': date.strftime('%Y-%m-%d'),
                'day': date.strftime('%a'),
                'total': 0
            })
        
        for item in data:
            date_str = item['date'].strftime('%Y-%m-%d') if isinstance(item['date'], datetime) else str(item['date'])
            for day in days:
                if day['date'] == date_str:
                    day['total'] = float(item['total'])
                    break
        
        cursor.close()
        connection.close()
        
        return jsonify({'success': True, 'chart_data': days})
    
    except Exception as e:
        if 'cursor' in locals():
            cursor.close()
            connection.close()
        return jsonify({'success': False, 'error': str(e)}), 500

@feed_bp.route('/feed/alerts')
def get_alerts():
    user_id = session.get('user_id')
    
    connection = get_db()
    cursor = connection.cursor(dictionary=True)
    
    try:
        cursor.execute("""
            SELECT fs.*, 
                   COALESCE(
                       (SELECT AVG(fu.quantity_used) 
                        FROM feed_usage fu 
                        WHERE fu.feed_id = fs.id
                       ), 0
                   ) as avg_daily_usage
            FROM feed_stock fs
            WHERE fs.user_id = %s AND fs.quantity <= fs.min_quantity
            ORDER BY (fs.quantity / fs.min_quantity) ASC
        """, (user_id,))
        
        alerts = cursor.fetchall()
        
        for alert in alerts:
            if alert['min_quantity'] and alert['min_quantity'] > 0:
                alert['stock_percentage'] = round((alert['quantity'] / alert['min_quantity'] * 100), 2)
            else:
                alert['stock_percentage'] = 0
                
            if alert['avg_daily_usage'] and alert['avg_daily_usage'] > 0:
                alert['days_remaining'] = round(alert['quantity'] / alert['avg_daily_usage'])
            else:
                alert['days_remaining'] = 999
                
            if isinstance(alert.get('updated_at'), datetime):
                alert['updated_at'] = alert['updated_at'].strftime('%Y-%m-%d %H:%M:%S')
        
        cursor.close()
        connection.close()
        
        return jsonify({'success': True, 'alerts': alerts})
    
    except Exception as e:
        if 'cursor' in locals():
            cursor.close()
            connection.close()
        return jsonify({'success': False, 'error': str(e)}), 500

@feed_bp.route('/feed/stock-value')
def get_stock_value():
    user_id = session.get('user_id')
    
    connection = get_db()
    cursor = connection.cursor(dictionary=True)
    
    try:
        cursor.execute("""
            SELECT 
                SUM(quantity * cost_per_kg) as total_value,
                SUM(CASE WHEN LOWER(feed_name) LIKE '%%fodder%%' THEN quantity * cost_per_kg ELSE 0 END) as fodder_value,
                SUM(CASE WHEN LOWER(feed_name) LIKE '%%wheat%%' OR LOWER(feed_name) LIKE '%%grain%%' 
                    THEN quantity * cost_per_kg ELSE 0 END) as grain_value,
                SUM(CASE WHEN LOWER(feed_name) NOT LIKE '%%fodder%%' 
                    AND LOWER(feed_name) NOT LIKE '%%wheat%%' 
                    AND LOWER(feed_name) NOT LIKE '%%grain%%' 
                    THEN quantity * cost_per_kg ELSE 0 END) as other_value
            FROM feed_stock
            WHERE user_id = %s
        """, (user_id,))
        
        result = cursor.fetchone()
        
        value_data = {
            'total_value': float(result['total_value'] or 0),
            'fodder_value': float(result['fodder_value'] or 0),
            'grain_value': float(result['grain_value'] or 0),
            'other_value': float(result['other_value'] or 0)
        }
        
        cursor.close()
        connection.close()
        
        return jsonify({'success': True, 'value_data': value_data})
    
    except Exception as e:
        if 'cursor' in locals():
            cursor.close()
            connection.close()
        return jsonify({'success': False, 'error': str(e)}), 500

@feed_bp.route('/feed/cattle-list')
def get_cattle_list():
    user_id = session.get('user_id')
    
    connection = get_db()
    cursor = connection.cursor(dictionary=True)
    
    try:
        cursor.execute("""
            SELECT id, tag_no, name
            FROM cattle
            WHERE user_id = %s
            ORDER BY name
        """, (user_id,))
        
        cattle = cursor.fetchall()
        
        cursor.close()
        connection.close()
        
        return jsonify({'success': True, 'cattle': cattle})
    
    except Exception as e:
        if 'cursor' in locals():
            cursor.close()
            connection.close()
        return jsonify({'success': False, 'error': str(e)}), 500
