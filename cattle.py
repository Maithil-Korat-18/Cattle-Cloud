from flask import Blueprint, render_template, request, jsonify, session, redirect, url_for
from db import get_db
from datetime import date

cattle_bp = Blueprint("cattle_bp", __name__)

def login_required():
    return "user_id" in session


# ================= CATTLE DETAIL PAGE =================
@cattle_bp.route("/cattle/<int:cattle_id>")
def cattle_detail(cattle_id):
    if not login_required():
        return redirect(url_for("login_page"))

    user_id = session["user_id"]
    conn = get_db()
    cur = conn.cursor(dictionary=True)

    # ---- Get cattle info ----
    cur.execute("""
        SELECT id, name, breed, age, health
        FROM cattle
        WHERE id=%s AND user_id=%s
    """, (cattle_id, user_id))
    cattle = cur.fetchone()

    if not cattle:
        cur.close()
        conn.close()
        return redirect(url_for("dashboard"))

    # ---- Last 7 days milk ----
    cur.execute("""
        SELECT date, milk_liters AS quantity
        FROM milk_records
        WHERE cattle_id=%s
        ORDER BY date DESC
        LIMIT 7
    """, (cattle_id,))
    rows = cur.fetchall()
    rows.reverse()  # oldest → newest

    avg_milk = round(
        sum(r["quantity"] for r in rows) / len(rows), 1
    ) if rows else 0

    cur.close()
    conn.close()

    return render_template(
        "cattle_detail.html",
        cattle=cattle,
        default_history=rows,
        avg_milk=avg_milk,
        username=session.get("full_name", "User")
    )


# ================= FILTER API =================
@cattle_bp.route("/api/cattle/<int:cattle_id>/filter", methods=["POST"])
def filter_cattle_data(cattle_id):
    if not login_required():
        return jsonify(success=False), 401

    user_id = session["user_id"]
    data = request.get_json()
    view_type = data.get("view_type")

    conn = get_db()
    cur = conn.cursor(dictionary=True)

    # Verify ownership
    cur.execute(
        "SELECT id FROM cattle WHERE id=%s AND user_id=%s",
        (cattle_id, user_id)
    )
    if not cur.fetchone():
        cur.close()
        conn.close()
        return jsonify(success=False), 403

    # Build query
    if view_type == "last_7":
        query = """
            SELECT date, milk_liters AS quantity
            FROM milk_records
            WHERE cattle_id=%s
            ORDER BY date DESC
            LIMIT 7
        """
        params = (cattle_id,)

    elif view_type == "all_time":
        query = """
            SELECT date, milk_liters AS quantity
            FROM milk_records
            WHERE cattle_id=%s
            ORDER BY date
        """
        params = (cattle_id,)

    elif view_type == "custom":
        query = """
            SELECT date, milk_liters AS quantity
            FROM milk_records
            WHERE cattle_id=%s AND date BETWEEN %s AND %s
            ORDER BY date
        """
        params = (cattle_id, data["start_date"], data["end_date"])

    else:
        cur.close()
        conn.close()
        return jsonify(success=False), 400

    cur.execute(query, params)
    rows = cur.fetchall()

    if view_type == "last_7":
        rows.reverse()

    if rows:
        total_milk = sum(r["quantity"] for r in rows)
        avg_milk = round(total_milk / len(rows), 1)
        highest_day = max(rows, key=lambda x: x["quantity"])
    else:
        total_milk = avg_milk = 0
        highest_day = {"date": "-", "quantity": 0}

    cur.close()
    conn.close()

    return jsonify(
        success=True,
        data={
            "history": rows,
            "total_milk": total_milk,
            "avg_milk": avg_milk,
            "highest_day": highest_day,
            "record_count": len(rows)
        }
    )
