from flask import render_template, session, redirect, url_for,Blueprint
from db import get_db


home_bp = Blueprint("home_bp", __name__)
@home_bp.route("/home")
def user_home():
    if "user_id" not in session:
        return redirect(url_for("login_page"))

    user_id = session["user_id"]
    conn = get_db()
    cur = conn.cursor(dictionary=True)

    # -------- TOTAL CATTLE --------
    cur.execute("SELECT COUNT(*) AS total FROM cattle WHERE user_id=%s", (user_id,))
    total_cattle = cur.fetchone()["total"]

    # -------- WEEKLY MILK --------
    cur.execute("""
        SELECT IFNULL(SUM(milk_liters),0) AS total
        FROM milk_records
        WHERE user_id=%s AND date >= CURDATE() - INTERVAL 7 DAY
    """, (user_id,))
    milk_this_week = cur.fetchone()["total"]

    # -------- WEEKLY MILK GRAPH (last 7 days) --------
    cur.execute("""
        SELECT date, IFNULL(SUM(milk_liters),0) AS qty
        FROM milk_records
        WHERE user_id=%s AND date >= CURDATE() - INTERVAL 7 DAY
        GROUP BY date
        ORDER BY date
    """, (user_id,))
    weekly_rows = cur.fetchall()
    weekly_milk = [row["qty"] for row in weekly_rows]

    # -------- MONTHLY AVERAGE --------
    cur.execute("""
        SELECT IFNULL(AVG(daily_total),0) AS avg_milk
        FROM (
            SELECT SUM(milk_liters) AS daily_total
            FROM milk_records
            WHERE user_id=%s
            GROUP BY date
        ) x
    """, (user_id,))
    monthly_average = round(cur.fetchone()["avg_milk"], 1)

    # -------- HEALTH ALERTS (example logic) --------
    cur.execute("""
        SELECT COUNT(*) AS alerts
        FROM cattle
        WHERE user_id=%s AND health != 'Good'
    """, (user_id,))
    health_alerts = cur.fetchone()["alerts"]

    cur.close()
    conn.close()

    data = {
        "total_cattle": total_cattle,
        "milk_this_week": milk_this_week,
        "weekly_milk": weekly_milk if weekly_milk else [0,0,0,0,0,0,0],
        "monthly_average": monthly_average,
        "health_alerts": health_alerts
    }

    return render_template(
        "home.html",
        username=session.get("full_name", "User"),
        data=data
    )
