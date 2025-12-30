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
        cur.close()
        conn.close()
        return jsonify({
            "success": False,
            "message": "User already registered"
        })

    hashed = bcrypt.hashpw(password.encode(), bcrypt.gensalt())

    # INSERT USER
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
    print("\n" + "="*50)
    print("🔐 LOGIN API CALLED")
    print("="*50)

    data = request.get_json(silent=True)
    if not data:
        print("❌ No data received")
        return jsonify({"success": False, "message": "No data received"}), 400

    email_or_phone = data.get("emailOrPhone")
    password = data.get("password")

    print(f"📧 Login attempt: {email_or_phone}")

    if not email_or_phone or not password:
        print("❌ Missing credentials")
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
            print("❌ User not found")
            return jsonify({"success": False, "message": "User not registered"}), 401

        if not bcrypt.checkpw(password.encode(), user["password"].encode()):
            print("❌ Wrong password")
            return jsonify({"success": False, "message": "Wrong password"}), 401
        
        # ✅ CLEAR AND SET SESSION
        session.clear()
        session.permanent = True
        session["user_id"] = user["id"]
        session["email"] = user["email"]
        session["full_name"] = user["full_name"]
        
        print(f"✅ Session created successfully!")
        print(f"   User ID: {session.get('user_id')}")
        print(f"   Email: {session.get('email')}")
        print(f"   Session Data: {dict(session)}")
        print("="*50 + "\n")
        
        return jsonify({
            "success": True,
            "message": "Login successful",
            "user": {
                "id": user["id"],
                "full_name": user["full_name"],
                "email": user["email"]
            }
        })

    except Exception as e:
        print(f"❌ LOGIN ERROR: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({
            "success": False,
            "message": "Server error"
        }), 500


# ================= GOOGLE LOGIN =================
@auth.route("/api/google-login", methods=["POST"])
def google_login():
    print("\n" + "="*50)
    print("🔐 GOOGLE LOGIN API CALLED")
    print("="*50)
    
    data = request.get_json()
    email = data.get("email")
    name = data.get("name")
    google_id = data.get("googleId")
    
    if not email or not name:
        return jsonify({"success": False, "message": "Missing data"}), 400
    
    try:
        conn = get_db()
        cur = conn.cursor(dictionary=True)
        
        # Check if user exists
        cur.execute("SELECT * FROM users WHERE email=%s", (email,))
        user = cur.fetchone()
        
        if not user:
            # Create new user
            cur.execute("""
                INSERT INTO users (full_name, email, phone, password)
                VALUES (%s, %s, %s, %s)
            """, (name, email, 'google_user', bcrypt.hashpw(google_id.encode(), bcrypt.gensalt())))
            conn.commit()
            
            # Get the new user
            cur.execute("SELECT * FROM users WHERE email=%s", (email,))
            user = cur.fetchone()
        
        cur.close()
        conn.close()
        
        # Set session
        session.clear()
        session.permanent = True
        session["user_id"] = user["id"]
        session["email"] = user["email"]
        session["full_name"] = user["full_name"]
        
        print(f"✅ Google login successful!")
        print(f"   Session: {dict(session)}")
        print("="*50 + "\n")
        
        return jsonify({
            "success": True,
            "message": "Google login successful",
            "user": {
                "id": user["id"],
                "full_name": user["full_name"],
                "email": user["email"]
            }
        })
        
    except Exception as e:
        print(f"❌ GOOGLE LOGIN ERROR: {e}")
        import traceback
        traceback.print_exc()
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
        cur.close()
        conn.close()
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
        cur.close()
        conn.close()
        return jsonify({"success": False, "message": "Invalid or expired OTP"})

    cur.execute("DELETE FROM otp_data WHERE id=%s", (row["id"],))
    conn.commit()
    cur.close()
    conn.close()

    return jsonify({"success": True})


# ---------------- SEND RESET CODE ----------------
@auth.route("/api/send-reset-code", methods=["POST"])
def send_reset_code():
    data = request.get_json()
    email = data.get("email")

    if not email:
        return jsonify({"success": False, "message": "Email required"}), 400

    conn = get_db()
    cur = conn.cursor()

    # Check if user exists
    cur.execute("SELECT id FROM users WHERE email=%s", (email,))
    if not cur.fetchone():
        cur.close()
        conn.close()
        return jsonify({
            "success": False,
            "message": "Email not registered"
        })

    otp = str(random.randint(100000, 999999))

    # Remove old reset OTP
    cur.execute(
        "DELETE FROM otp_data WHERE email=%s AND purpose='reset'",
        (email,)
    )

    # Insert new reset OTP
    cur.execute(
        "INSERT INTO otp_data (email, otp, purpose) VALUES (%s, %s, 'reset')",
        (email, otp)
    )

    conn.commit()
    cur.close()
    conn.close()

    # Send email
    if send_otp_email(email, otp, "reset"):
        return jsonify({"success": True})
    else:
        return jsonify({"success": False, "message": "Email sending failed"}), 500


# ---------------- RESET PASSWORD ----------------
@auth.route("/api/reset-password", methods=["POST"])
def reset_password():
    data = request.get_json()
    email = data.get("email")
    password = data.get("password")

    if not email or not password:
        return jsonify({"success": False, "message": "Email and password required"}), 400

    conn = get_db()
    cur = conn.cursor()

    hashed = bcrypt.hashpw(password.encode(), bcrypt.gensalt())

    cur.execute(
        "UPDATE users SET password=%s WHERE email=%s",
        (hashed, email)
    )

    conn.commit()
    cur.close()
    conn.close()

    return jsonify({"success": True, "message": "Password reset successful"})
