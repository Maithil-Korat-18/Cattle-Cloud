from flask import render_template, session, redirect, url_for, Blueprint
from db import get_db
from datetime import datetime, timedelta

home_bp = Blueprint("home_bp", __name__)

@home_bp.route("/home")
def user_home():
    if "user_id" not in session:
        return redirect(url_for("login_page"))

    user_id = session["user_id"]
    conn = get_db()
    cur = conn.cursor(dictionary=True)

    try:
        # -------- TOTAL CATTLE --------
        cur.execute("SELECT COUNT(*) AS total FROM cattle WHERE user_id=%s", (user_id,))
        total_cattle = cur.fetchone()["total"]

        # -------- MILK TODAY --------
        cur.execute("""
            SELECT IFNULL(SUM(milk_liters),0) AS total
            FROM milk_records
            WHERE user_id=%s AND date = CURDATE()
        """, (user_id,))
        milk_today = round(cur.fetchone()["total"], 1)

        # -------- TODAY'S INCOME --------
        cur.execute("""
            SELECT IFNULL(SUM(income),0) AS total
            FROM milk_records
            WHERE user_id=%s AND date = CURDATE()
        """, (user_id,))
        today_income = round(cur.fetchone()["total"], 2)



        # -------- WEEKLY MILK --------
        cur.execute("""
            SELECT IFNULL(SUM(milk_liters),0) AS total
            FROM milk_records
            WHERE user_id=%s AND date >= CURDATE() - INTERVAL 7 DAY
        """, (user_id,))
        milk_this_week = round(cur.fetchone()["total"], 1)

        # -------- WEEKLY MILK GRAPH (last 7 days with proper date filling) --------
        # Get last 7 days of data
        cur.execute("""
            SELECT DATE(date) as record_date, IFNULL(SUM(milk_liters),0) AS qty
            FROM milk_records
            WHERE user_id=%s AND date >= CURDATE() - INTERVAL 6 DAY
            GROUP BY DATE(date)
            ORDER BY DATE(date)
        """, (user_id,))
        weekly_rows = cur.fetchall()
        
        # Create a dictionary of dates to milk quantities
        milk_by_date = {row["record_date"]: float(row["qty"]) for row in weekly_rows}
        
        # Fill in all 7 days (including days with no records)
        weekly_milk = []
        weekly_labels = []
        today = datetime.now().date()
        for i in range(6, -1, -1):  # 6 days ago to today
            day = today - timedelta(days=i)
            weekly_milk.append(milk_by_date.get(day, 0))
            weekly_labels.append(day.strftime("%d %b"))  

        # -------- MONTHLY AVERAGE --------
        cur.execute("""
            SELECT IFNULL(AVG(daily_total),0) AS avg_milk
            FROM (
                SELECT SUM(milk_liters) AS daily_total
                FROM milk_records
                WHERE user_id=%s AND date >= CURDATE() - INTERVAL 30 DAY
                GROUP BY DATE(date)
            ) x
        """, (user_id,))
        monthly_average = round(cur.fetchone()["avg_milk"], 1)
        # -------- MILK CHANGE % --------
        if monthly_average > 0:
            milk_change = round(((milk_today - monthly_average) / monthly_average) * 100, 1)
        else:
            milk_change = 0


        # -------- HEALTH ALERTS --------
        # Count cattle with health status other than 'Excellent' or 'Good'
        cur.execute("""
            SELECT COUNT(*) AS alerts
            FROM cattle
            WHERE user_id=%s 
            AND LOWER(health) NOT IN ('excellent', 'good')
        """, (user_id,))
        health_alerts = cur.fetchone()["alerts"]

        # -------- RECENT ACTIVITY (Combined from multiple sources) --------
        all_activities = []

        # 1. Get recent milk records
        cur.execute("""
            SELECT 
                'milk' as activity_type,
                mr.date as activity_date,
                mr.created_at,
                mr.milk_liters,
                mr.income,
                c.name,
                c.id as cattle_id,
                mr.id as record_id
            FROM milk_records mr
            JOIN cattle c ON mr.cattle_id = c.id
            WHERE mr.user_id=%s
            ORDER BY mr.created_at DESC
            LIMIT 10
        """, (user_id,))
        milk_records = cur.fetchall()
        
        for record in milk_records:
            all_activities.append({
                'type': 'milk',
                'date': record['created_at'],
                'data': record
            })

        # 2. Get recent expenses
        cur.execute("""
            SELECT 
                'expense' as activity_type,
                e.date as activity_date,
                e.created_at,
                e.category,
                e.amount,
                e.id as expense_id
            FROM expenses e
            WHERE e.user_id=%s
            ORDER BY e.created_at DESC
            LIMIT 10
        """, (user_id,))
        expense_records = cur.fetchall()
        
        for record in expense_records:
            all_activities.append({
                'type': 'expense',
                'date': record['created_at'],
                'data': record
            })

        # 3. Get recently added cattle
        cur.execute("""
            SELECT 
                'new_cattle' as activity_type,
                c.created_at,
                c.name,
                c.id as cattle_id,
                c.breed,
                c.age
            FROM cattle c
            WHERE c.user_id=%s
            ORDER BY c.created_at DESC
            LIMIT 10
        """, (user_id,))
        new_cattle = cur.fetchall()
        
        for record in new_cattle:
            all_activities.append({
                'type': 'new_cattle',
                'date': record['created_at'],
                'data': record
            })

        # Sort all activities by date and take the most recent 8
        all_activities.sort(key=lambda x: x['date'], reverse=True)
        recent_activities = all_activities[:5]

        # Format activities for display
        activities = []
        for activity in recent_activities:
            time_ago = get_time_ago(activity['date'])
            data = activity['data']
            
            if activity['type'] == 'milk':
                activities.append({
                    'icon': '🥛',
                    'title': f"Milk record: {data['name']}",
                    'subtitle': f"Produced {data['milk_liters']}L • Income ₹{data['income']}",
                    'time': time_ago,
                    'color': '#4facfe'
                })
            
            elif activity['type'] == 'expense':
                expense_icons = {
                    'feed': '🌾',
                    'medical': '💊',
                    'medicine': '💉',
                    'equipment': '🔧',
                    'veterinary': '🏥',
                    'labor': '👷',
                    'maintenance': '🛠️',
                    'other': '💰'
                }
                icon = expense_icons.get(data['category'].lower(), '💰')
                activities.append({
                    'icon': icon,
                    'title': f"Expense: {data['category']}",
                    'subtitle': f"Amount: ₹{data['amount']}",
                    'time': time_ago,
                    'color': '#fa709a'
                })
            
            elif activity['type'] == 'new_cattle':
                activities.append({
                    'icon': '🐄',
                    'title': f"New cattle added: {data['name']} ",
                    'subtitle': f"{data['breed']} • {data['age']} years old",
                    'time': time_ago,
                    'color': '#667eea'
                })

        # If no activities, add placeholder
        if not activities:
            activities = [
                {
                    'icon': '📋',
                    'title': 'No recent activities',
                    'subtitle': 'Start adding records to see activity here',
                    'time': 'Just now',
                    'color': '#999'
                }
            ]

    except Exception as e:
        print(f"Error fetching home data: {e}")
        import traceback
        traceback.print_exc()
        # Provide default values in case of error
        total_cattle = 0
        milk_this_week = 0
        weekly_milk = [0] * 7
        weekly_labels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
        monthly_average = 0
        health_alerts = 0
        activities = []
    finally:
        cur.close()
        conn.close()

    data = {
        "total_cattle": total_cattle,
        "milk_today": milk_today,
        "milk_change": milk_change,
        "today_income": today_income,
        "milk_this_week": milk_this_week,
        "weekly_milk": weekly_milk,
        "weekly_labels": weekly_labels,
        "monthly_average": monthly_average,
        "health_alerts": health_alerts,
        "activities": activities
    }


    return render_template(
        "home.html",
        username=session.get("full_name", "User"),
        data=data
    )


def get_time_ago(date_obj):
    """Convert a datetime/date to a human-readable 'time ago' format"""
    if isinstance(date_obj, str):
        try:
            # Try parsing as datetime first
            date_obj = datetime.strptime(date_obj, "%Y-%m-%d %H:%M:%S")
        except:
            try:
                # Try parsing as date
                date_obj = datetime.strptime(date_obj, "%Y-%m-%d")
            except:
                return "Recently"
    
    # If it's a date object, convert to datetime
    if isinstance(date_obj, type(datetime.now().date())):
        date_obj = datetime.combine(date_obj, datetime.min.time())
    
    now = datetime.now()
    delta = now - date_obj
    
    # Calculate time difference
    seconds = delta.total_seconds()
    minutes = seconds / 60
    hours = minutes / 60
    days = delta.days
    
    if seconds < 60:
        return "Just now"
    elif minutes < 60:
        mins = int(minutes)
        return f"{mins} minute{'s' if mins != 1 else ''} ago"
    elif hours < 24:
        hrs = int(hours)
        return f"{hrs} hour{'s' if hrs != 1 else ''} ago"
    elif days == 1:
        return "Yesterday"
    elif days < 7:
        return f"{days} days ago"
    elif days < 14:
        return "1 week ago"
    elif days < 30:
        weeks = days // 7
        return f"{weeks} weeks ago"
    elif days < 60:
        return "1 month ago"
    else:
        months = days // 30
        return f"{months} months ago"
