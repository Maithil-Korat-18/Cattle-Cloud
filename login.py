import random
from mail_utils import send_otp_email
from flask import Blueprint, request, jsonify, session
import bcrypt
from db import get_db

auth = Blueprint("auth", __name__)


# ================= REGISTER =================
@auth.route("/api/register", methods=["POST"])
def register():
    data = request.get_json()

    full_name = data.get("fullName")
    phone = data.get("phone")
    email = data.get("email")
    password = data.get("password")

    if not all([full_name, phone, email, password]):
        return jsonify({"success": False, "message": "All fields required"}), 400

    conn = get_db()
    cur = conn.cursor()

    # check existing user
    cur.execute("SELECT id FROM users WHERE email=%s", (email,))
    if cur.fetchone():
        return jsonify({
            "success": False,
            "message": "User already registered"
        })

    hashed = bcrypt.hashpw(password.encode(), bcrypt.gensalt())

    # INSERT USER ✅
    cur.execute("""
        INSERT INTO users (full_name, phone, email, password)
        VALUES (%s, %s, %s, %s)
    """, (full_name, phone, email, hashed))

    conn.commit()
    cur.close()
    conn.close()

    return jsonify({
        "success": True,
        "message": "Registration successful"
    })


# ================= LOGIN =================
@auth.route("/api/login", methods=["POST"])
def login():
    print("LOGIN API HIT")

    data = request.get_json(silent=True)
    if not data:
        return jsonify({"success": False, "message": "No data received"}), 400

    email_or_phone = data.get("emailOrPhone")
    password = data.get("password")

    if not email_or_phone or not password:
        return jsonify({"success": False, "message": "Missing credentials"}), 400

    try:
        conn = get_db()
        cur = conn.cursor(dictionary=True)

        if "@" in email_or_phone:
            cur.execute("SELECT * FROM users WHERE email=%s", (email_or_phone,))
        else:
            cur.execute("SELECT * FROM users WHERE phone=%s", (email_or_phone,))

        user = cur.fetchone()

        cur.close()
        conn.close()

        if not user:
            return jsonify({"success": False, "message": "User not registered"}), 401

        if not bcrypt.checkpw(password.encode(), user["password"].encode()):
            return jsonify({"success": False, "message": "Wrong password"}), 401
        session.clear()
        session["user_id"] = user["id"]
        session["email"] = user["email"]
        print("Ho Ja Bhai")
        return jsonify({
            "success": True,
            "user": {
                "id": user["id"],
                "full_name": user["full_name"],
                "email": user["email"]
        }
    })

    except Exception as e:
        print("LOGIN ERROR:", e)
        return jsonify({
            "success": False,
            "message": "Server error"
        }), 500
# ---------------- SEND OTP ----------------
@auth.route("/api/send-verification-code", methods=["POST"])
def send_verification_code():
    data = request.get_json()
    email = data.get("email")

    if not email:
        return jsonify({"success": False, "message": "Email required"}), 400

    otp = str(random.randint(100000, 999999))

    conn = get_db()
    cur = conn.cursor()

    # Prevent duplicate registration
    cur.execute("SELECT id FROM users WHERE email=%s", (email,))
    if cur.fetchone():
        return jsonify({
            "success": False,
            "message": "You are already registered. Please login."
        })

    # Remove old OTP
    cur.execute(
        "DELETE FROM otp_data WHERE email=%s AND purpose='registration'",
        (email,)
    )

    # Insert new OTP
    cur.execute(
        "INSERT INTO otp_data (email, otp, purpose) VALUES (%s, %s, 'registration')",
        (email, otp)
    )

    conn.commit()
    cur.close()
    conn.close()

    # Send email
    if send_otp_email(email, otp, "registration"):
        return jsonify({"success": True})
    else:
        return jsonify({"success": False, "message": "Email sending failed"}), 500


# ---------------- VERIFY OTP ----------------
@auth.route("/api/verify-code", methods=["POST"])
def verify_code():
    data = request.get_json()
    email = data.get("email")
    code = data.get("code")

    if not email or not code:
        return jsonify({"success": False, "message": "Email and OTP required"})

    conn = get_db()
    cur = conn.cursor(dictionary=True)

    cur.execute("""
        SELECT * FROM otp_data
        WHERE email=%s AND otp=%s
        AND created_at > NOW() - INTERVAL 10 MINUTE
    """, (email, code))

    row = cur.fetchone()

    if not row:
        return jsonify({"success": False, "message": "Invalid or expired OTP"})

    cur.execute("DELETE FROM otp_data WHERE id=%s", (row["id"],))
    conn.commit()
    cur.close()
    conn.close()

    return jsonify({"success": True})
