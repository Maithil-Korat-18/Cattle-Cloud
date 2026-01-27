from flask import Blueprint, render_template, session, redirect, url_for
from db import get_db

records_bp = Blueprint("records_bp", __name__)

def login_required():
    return "user_id" in session


@records_bp.route("/records")
def records():
    if not login_required():
        return redirect(url_for("login_page"))

    user_id = session["user_id"]
    conn = get_db()
    cur = conn.cursor(dictionary=True)

    # -------- Milk Records --------
    cur.execute("""
        SELECT 
            mr.date,
            c.name AS cow_name,
            mr.milk_liters AS quantity,
            mr.rate,
            mr.income
        FROM milk_records mr
        JOIN cattle c ON mr.cattle_id = c.id
        WHERE mr.user_id = %s
        ORDER BY mr.date DESC
    """, (user_id,))
    milk_records = cur.fetchall()

    # -------- Expense Records --------
    cur.execute("""
        SELECT 
            date,
            category AS type,
            amount
        FROM expenses
        WHERE user_id = %s
        ORDER BY date DESC
    """, (user_id,))
    expense_records = cur.fetchall()

    cur.close()
    conn.close()

    return render_template(
        "records.html",
        milk_records=milk_records,
        expense_records=expense_records,
        username=session.get("full_name", "User")
    )
