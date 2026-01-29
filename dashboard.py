from flask import render_template, request, jsonify, session, redirect, url_for, Blueprint
from db import get_db

dashboard_bp = Blueprint("dashboard_bp", __name__)

def login_required():
    return "user_id" in session

# ================= DASHBOARD =================
@dashboard_bp.route("/dashboard",endpoint="dashboard")
def dashboard():
    if not login_required():
        return redirect(url_for("login"))

    user_id = session["user_id"]
    conn = get_db()
    cursor = conn.cursor(dictionary=True)

    cursor.execute("SELECT COUNT(*) AS total FROM cattle WHERE user_id=%s", (user_id,))
    total_cattle = cursor.fetchone()["total"]

    cursor.execute("""
        SELECT SUM(milk_liters) AS total
        FROM milk_records
        WHERE user_id=%s AND date >= CURDATE() - INTERVAL 7 DAY
    """, (user_id,))
    total_weekly_milk = cursor.fetchone()["total"] or 0

    cursor.execute("""
        SELECT SUM(milk_liters) AS milk, SUM(income) AS income
        FROM milk_records
        WHERE user_id=%s AND date=CURDATE()
    """, (user_id,))
    today = cursor.fetchone()
    today_milk = today["milk"] or 0
    today_income = today["income"] or 0

    cursor.execute("""
        SELECT SUM(amount) AS expense
        FROM expenses
        WHERE user_id=%s AND date=CURDATE()
    """, (user_id,))
    today_expense = cursor.fetchone()["expense"] or 0

    cursor.execute("SELECT SUM(income) AS total FROM milk_records WHERE user_id=%s", (user_id,))
    total_income = cursor.fetchone()["total"] or 0

    cursor.execute("SELECT SUM(amount) AS total FROM expenses WHERE user_id=%s", (user_id,))
    total_expense = cursor.fetchone()["total"] or 0

    net_profit = total_income - total_expense

    cursor.execute("""
        SELECT id, name, breed, health
        FROM cattle
        WHERE user_id=%s
    """, (user_id,))
    cattle_list = cursor.fetchall()

    cursor.close()
    conn.close()

    stats = {
        "total_cattle": total_cattle,
        "total_weekly_milk": total_weekly_milk,
        "today_milk": today_milk,
        "today_income": today_income,
        "today_expense": today_expense,
        "net_profit": net_profit
    }

    return render_template(
        "dashboard.html",
        stats=stats,
        cattle_list=cattle_list,
        username=session["full_name"]
    )

# ================= ADD MILK =================
@dashboard_bp.route("/add-milk", methods=["POST"])
def add_milk():
    if not login_required():
        return jsonify(success=False)

    data = request.json
    user_id = session["user_id"]

    conn = get_db()
    cursor = conn.cursor()

    cursor.execute(
        "SELECT id FROM cattle WHERE user_id=%s AND name=%s",
        (user_id, data["cow_name"])
    )
    row = cursor.fetchone()
    if not row:
        return jsonify(success=False, message="Cow not found")

    cattle_id = row[0]
    income = float(data["milk_liters"]) * float(data["rate"])

    cursor.execute("""
        INSERT INTO milk_records(user_id, cattle_id, date, milk_liters, rate, income)
        VALUES (%s,%s,%s,%s,%s,%s)
    """, (
        user_id,
        cattle_id,
        data["date"],
        data["milk_liters"],
        data["rate"],
        income
    ))

    conn.commit()
    cursor.close()
    conn.close()

    return jsonify(success=True, message="Milk recorded")

# ================= ADD EXPENSE =================
@dashboard_bp.route("/add-expense", methods=["POST"])
def add_expense():
    if not login_required():
        return jsonify(success=False)

    data = request.json
    conn = get_db()
    cursor = conn.cursor()

    cursor.execute("""
        INSERT INTO expenses(user_id, date, category, amount)
        VALUES (%s,%s,%s,%s)
    """, (
        session["user_id"],
        data["date"],
        data["type"],
        data["amount"]
    ))

    conn.commit()
    cursor.close()
    conn.close()

    return jsonify(success=True, message="Expense added")

# ================= ADD CATTLE =================
@dashboard_bp.route("/add-cattle", methods=["POST"])
def add_cattle():
    if not login_required():
        return jsonify(success=False)

    data = request.json
    conn = get_db()
    cursor = conn.cursor()

    cursor.execute("""
        INSERT INTO cattle(user_id, name, breed, age, health)
        VALUES (%s,%s,%s,%s,%s)
    """, (
        session["user_id"],
        data["name"],
        data["breed"],
        data["age"],
        data["health"]
    ))

    conn.commit()
    cursor.close()
    conn.close()

    return jsonify(success=True, message="Cattle added")
