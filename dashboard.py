from flask import render_template, request, jsonify, session, redirect, url_for, Blueprint
from db import get_db
from datetime import date, timedelta,datetime
dashboard_bp = Blueprint("dashboard_bp", __name__)

@dashboard_bp.route('/dashboard')
def dashboard():
    """Main dashboard with all statistics and data"""
    user_id = session.get('user_id')
    connection = get_db()
    
    if not connection:
        flash('Database connection error', 'danger')
        return redirect(url_for('login'))
    
    cursor = connection.cursor(dictionary=True)
    
    # Get total cattle count
    cursor.execute("SELECT COUNT(*) as count FROM cattle WHERE user_id = %s", (user_id,))
    total_cattle = cursor.fetchone()['count']
    
    # Get today's milk yield
    today = datetime.now().date()
    cursor.execute("""
        SELECT COALESCE(SUM(milk_liters), 0) as total 
        FROM milk_records 
        WHERE user_id = %s AND date = %s
    """, (user_id, today))
    milk_today = float(cursor.fetchone()['total'])
    
    # Get monthly revenue
    current_month = datetime.now().month
    current_year = datetime.now().year
    cursor.execute("""
        SELECT COALESCE(SUM(income), 0) as total 
        FROM milk_records 
        WHERE user_id = %s AND MONTH(date) = %s AND YEAR(date) = %s
    """, (user_id, current_month, current_year))
    monthly_revenue = float(cursor.fetchone()['total'])
    
    # Get weekly milk data for chart (last 7 days)
    weekly_milk_data = []
    for i in range(6, -1, -1):
        date = today - timedelta(days=i)
        cursor.execute("""
            SELECT COALESCE(SUM(milk_liters), 0) as total 
            FROM milk_records 
            WHERE user_id = %s AND date = %s
        """, (user_id, date))
        daily_total = float(cursor.fetchone()['total'])
        weekly_milk_data.append({
            'day': date.strftime('%a'),
            'value': daily_total
        })
    
    # Get recent activities (last 10 records across different tables)
    recent_activities = []
    
    # Recent cattle additions
    cursor.execute("""
        SELECT 'cattle' as type, name, tag_no, breed, created_at 
        FROM cattle 
        WHERE user_id = %s 
        ORDER BY created_at DESC 
        LIMIT 3
    """, (user_id,))
    cattle_activities = cursor.fetchall()
    for activity in cattle_activities:
        recent_activities.append({
            'type': 'cattle',
            'icon': 'add_circle',
            'color': 'indigo',
            'title': 'New cattle added',
            'description': f"{activity['breed']} (ID: {activity['tag_no'] or 'N/A'}) - {activity['name']}",
            'time': get_time_ago(activity['created_at'])
        })
    
    # Recent milk records
    cursor.execute("""
        SELECT mr.*, c.name as cattle_name 
        FROM milk_records mr
        JOIN cattle c ON mr.cattle_id = c.id
        WHERE mr.user_id = %s 
        ORDER BY mr.created_at DESC 
        LIMIT 3
    """, (user_id,))
    milk_activities = cursor.fetchall()
    for activity in milk_activities:
        recent_activities.append({
            'type': 'milk',
            'icon': 'water_drop',
            'color': 'violet',
            'title': 'Milk batch recorded',
            'description': f"{activity['cattle_name']}: {activity['milk_liters']}L collected",
            'time': get_time_ago(activity['created_at'])
        })
    
    # Recent feed usage
    cursor.execute("""
        SELECT fu.*, fs.feed_name 
        FROM feed_usage fu
        JOIN feed_stock fs ON fu.feed_id = fs.id
        WHERE fu.user_id = %s 
        ORDER BY fu.created_at DESC 
        LIMIT 3
    """, (user_id,))
    feed_activities = cursor.fetchall()
    for activity in feed_activities:
        recent_activities.append({
            'type': 'feed',
            'icon': 'local_shipping',
            'color': 'indigo',
            'title': 'Feed delivery confirmed',
            'description': f"{activity['feed_name']}: {activity['quantity_used']}kg used",
            'time': get_time_ago(activity['created_at'])
        })
    
    # Sort all activities by time and take top 3
    recent_activities.sort(key=lambda x: x['time'])
    recent_activities = recent_activities[:3]
    
    # Get alerts
    alerts = []
    
    # Low feed stock alerts
    cursor.execute("""
        SELECT feed_name, quantity, min_quantity 
        FROM feed_stock 
        WHERE user_id = %s AND quantity < min_quantity
    """, (user_id,))
    low_stock = cursor.fetchall()
    for stock in low_stock:
        percentage = (stock['quantity'] / stock['min_quantity'] * 100) if stock['min_quantity'] > 0 else 0
        alerts.append({
            'type': 'danger',
            'title': f"Low Feed Stock: {stock['feed_name']}",
            'description': f"Inventory critical < {int(percentage)}%",
            'dot_color': 'danger'
        })
    
    # Upcoming vet appointments
    cursor.execute("""
        SELECT hr.*, c.name as cattle_name 
        FROM health_records hr
        JOIN cattle c ON hr.cattle_id = c.id
        WHERE hr.user_id = %s AND hr.next_checkup >= %s AND hr.next_checkup <= %s
        ORDER BY hr.next_checkup ASC
        LIMIT 3
    """, (user_id, today, today + timedelta(days=7)))
    vet_appointments = cursor.fetchall()
    for appointment in vet_appointments:
        alerts.append({
            'type': 'warning',
            'title': 'Vet Appointment',
            'description': f"{appointment['cattle_name']} - {appointment['vet_name']} on {appointment['next_checkup'].strftime('%b %d')}",
            'dot_color': 'warning'
        })
    
    # Add a success message if no critical alerts
    if len(alerts) < 3:
        alerts.append({
            'type': 'success',
            'title': 'System Update',
            'description': 'All systems operational',
            'dot_color': 'success'
        })
    
    cursor.close()
    connection.close()
    
    # Calculate percentage changes (mock data for now)
    cattle_change = 2.4
    milk_change = -1.2
    revenue_change = 5.8
    
    return render_template('dashboard.html',
                         user_name=session.get('full_name', 'User').split()[0],
                         total_cattle=total_cattle,
                         cattle_change=cattle_change,
                         milk_today=milk_today,
                         milk_change=milk_change,
                         monthly_revenue=monthly_revenue,
                         revenue_change=revenue_change,
                         weekly_milk_data=weekly_milk_data,
                         recent_activities=recent_activities,
                         alerts=alerts,
                         now=datetime.now())



def get_time_ago(timestamp):
    """Convert timestamp to 'time ago' format"""
    now = datetime.now()
    diff = now - timestamp
    
    if diff.days > 0:
        return f"{diff.days}d ago"
    elif diff.seconds >= 3600:
        hours = diff.seconds // 3600
        return f"{hours}h ago"
    elif diff.seconds >= 60:
        minutes = diff.seconds // 60
        return f"{minutes}m ago"
    else:
        return "just now"

