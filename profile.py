from flask import Blueprint, render_template, request, jsonify, session, redirect, url_for
from db import get_db
from datetime import datetime, timedelta
import re
import random
import bcrypt
# Assuming you have mail_utils.py with send_otp_email function
# If not, you'll need to import it from your existing mail utility
try:
    from mail_utils import send_otp_email
except ImportError:
    # Fallback if mail_utils doesn't exist
    def send_otp_email(email, otp, purpose=""):
        print(f"OTP for {email}: {otp} (purpose: {purpose})")
        return True

profile_bp = Blueprint("profile_bp", __name__)

def validate_email(email):
    pattern = r'^[\w\.-]+@[\w\.-]+\.\w+$'
    return re.match(pattern, email)

def generate_otp():
    return str(random.randint(100000, 999999))

@profile_bp.route("/profile")
def profile_page():
    if "user_id" not in session:
        return redirect(url_for("login_page"))
    
    user_id = session["user_id"]
    db = get_db()
    cursor = db.cursor(dictionary=True)
    
    # Get user data
    cursor.execute("SELECT * FROM users WHERE id = %s", (user_id,))
    user = cursor.fetchone()
    
    if not user:
        return redirect(url_for("logout"))
    
    # Format created_at date
    if user.get('created_at'):
        user['joined_date'] = user['created_at'].strftime('%d-%m-%Y')
    else:
        user['joined_date'] = 'N/A'
    
    # Get user stats
   
    
    cursor.close()
    db.close()
    
    return render_template(
        "profile.html",
        user=user
    )

@profile_bp.route("/api/profile/update", methods=["POST"])
def update_profile():
    try:
        data = request.get_json()
        
        if not data:
            return jsonify(success=False, message="No data provided"), 400
        
        user_id = session.get("user_id")
        if not user_id:
            return jsonify(success=False, message="Not authenticated"), 401
        
        db = get_db()
        cursor = db.cursor(dictionary=True)
        
        # Get current user
        cursor.execute("SELECT * FROM users WHERE id = %s", (user_id,))
        user = cursor.fetchone()
        
        if not user:
            return jsonify(success=False, message="User not found"), 404
        
        # Update fields
        full_name = data.get("full_name", user['full_name']).strip()
        phone = data.get("phone", user['phone']).strip()
        
        # Validation
        if not full_name or not phone:
            return jsonify(success=False, message="All fields are required"), 400
        
        # Update user (email is handled separately with verification)
        cursor.execute(
            "UPDATE users SET full_name = %s, phone = %s WHERE id = %s",
            (full_name, phone, user_id)
        )
        db.commit()
        
        cursor.close()
        db.close()
        
        return jsonify(
            success=True,
            message="Profile updated successfully",
            user={
                "full_name": full_name,
                "phone": phone
            }
        ), 200
        
    except Exception as e:
        print("PROFILE UPDATE ERROR:", e)
        return jsonify(success=False, message="Server error"), 500

# ===========================
# EMAIL CHANGE WITH VERIFICATION
# ===========================

@profile_bp.route("/api/profile/request-email-change", methods=["POST"])
def request_email_change():
    try:
        data = request.get_json()
        user_id = session.get("user_id")
        
        if not user_id:
            return jsonify(success=False, message="Not authenticated"), 401
        
        new_email = data.get("new_email", "").strip()
        
        if not new_email:
            return jsonify(success=False, message="Email is required"), 400
        
        if not validate_email(new_email):
            return jsonify(success=False, message="Invalid email format"), 400
        
        db = get_db()
        cursor = db.cursor(dictionary=True)
        
        # Check if email already exists
        cursor.execute("SELECT id FROM users WHERE email = %s AND id != %s", (new_email, user_id))
        if cursor.fetchone():
            return jsonify(success=False, message="Email already registered"), 400
        
        # Generate OTP
        otp = generate_otp()
        
        # Store OTP in database
        cursor.execute(
            "DELETE FROM otp_data WHERE email = %s AND purpose = 'email_change'",
            (new_email,)
        )
        cursor.execute(
            "INSERT INTO otp_data (email, otp, purpose) VALUES (%s, %s, 'email_change')",
            (new_email, otp)
        )
        db.commit()
        
        # Store new email in session temporarily
        session['pending_email'] = new_email
        
        # Send OTP email
        if send_otp_email(new_email, otp, purpose="email_change"):
            cursor.close()
            db.close()
            return jsonify(success=True, message="Verification code sent to new email"), 200
        else:
            cursor.close()
            db.close()
            return jsonify(success=False, message="Failed to send email"), 500
        
    except Exception as e:
        print("EMAIL CHANGE REQUEST ERROR:", e)
        return jsonify(success=False, message="Server error"), 500

@profile_bp.route("/api/profile/verify-email-change", methods=["POST"])
def verify_email_change():
    try:
        data = request.get_json()
        user_id = session.get("user_id")
        pending_email = session.get("pending_email")
        
        if not user_id or not pending_email:
            return jsonify(success=False, message="Invalid session"), 401
        
        otp = data.get("otp", "").strip()
        
        if not otp:
            return jsonify(success=False, message="OTP is required"), 400
        
        db = get_db()
        cursor = db.cursor(dictionary=True)
        
        # Verify OTP
        cursor.execute(
            """SELECT * FROM otp_data 
               WHERE email = %s AND otp = %s AND purpose = 'email_change' 
               AND created_at > NOW() - INTERVAL 10 MINUTE""",
            (pending_email, otp)
        )
        otp_record = cursor.fetchone()
        
        if not otp_record:
            return jsonify(success=False, message="Invalid or expired OTP"), 400
        
        # Update email
        cursor.execute(
            "UPDATE users SET email = %s WHERE id = %s",
            (pending_email, user_id)
        )
        
        # Delete used OTP
        cursor.execute(
            "DELETE FROM otp_data WHERE email = %s AND purpose = 'email_change'",
            (pending_email,)
        )
        
        db.commit()
        cursor.close()
        db.close()
        
        # Clear pending email from session
        session.pop('pending_email', None)
        
        return jsonify(
            success=True,
            message="Email updated successfully",
            email=pending_email
        ), 200
        
    except Exception as e:
        print("EMAIL VERIFICATION ERROR:", e)
        return jsonify(success=False, message="Server error"), 500

# ===========================
# PASSWORD CHANGE WITH VERIFICATION
# ===========================

@profile_bp.route("/api/profile/request-password-change", methods=["POST"])
def request_password_change():
    try:
        user_id = session.get("user_id")
        
        if not user_id:
            return jsonify(success=False, message="Not authenticated"), 401
        
        db = get_db()
        cursor = db.cursor(dictionary=True)
        
        # Get user email
        cursor.execute("SELECT email FROM users WHERE id = %s", (user_id,))
        user = cursor.fetchone()
        
        if not user:
            return jsonify(success=False, message="User not found"), 404
        
        user_email = user['email']
        
        # Generate OTP
        otp = generate_otp()
        
        # Store OTP in database
        cursor.execute(
            "DELETE FROM otp_data WHERE email = %s AND purpose = 'password_change'",
            (user_email,)
        )
        cursor.execute(
            "INSERT INTO otp_data (email, otp, purpose) VALUES (%s, %s, 'password_change')",
            (user_email, otp)
        )
        db.commit()
        
        # Send OTP email
        if send_otp_email(user_email, otp, purpose="password_change"):
            cursor.close()
            db.close()
            return jsonify(
                success=True,
                message="Verification code sent to your email",
                email=user_email
            ), 200
        else:
            cursor.close()
            db.close()
            return jsonify(success=False, message="Failed to send email"), 500
        
    except Exception as e:
        print("PASSWORD CHANGE REQUEST ERROR:", e)
        return jsonify(success=False, message="Server error"), 500

@profile_bp.route("/api/profile/verify-password-otp", methods=["POST"])
def verify_password_otp():
    try:
        data = request.get_json()
        user_id = session.get("user_id")
        
        if not user_id:
            return jsonify(success=False, message="Not authenticated"), 401
        
        otp = data.get("otp", "").strip()
        
        if not otp:
            return jsonify(success=False, message="OTP is required"), 400
        
        db = get_db()
        cursor = db.cursor(dictionary=True)
        
        # Get user email
        cursor.execute("SELECT email FROM users WHERE id = %s", (user_id,))
        user = cursor.fetchone()
        
        if not user:
            return jsonify(success=False, message="User not found"), 404
        
        # Verify OTP
        cursor.execute(
            """SELECT * FROM otp_data 
               WHERE email = %s AND otp = %s 
               AND created_at > NOW() - INTERVAL 10 MINUTE""",
            (user['email'], otp)
        )
        otp_record = cursor.fetchone()
        
        cursor.close()
        db.close()
        
        if not otp_record:
            return jsonify(success=False, message="Invalid or expired OTP"), 400
        
        # Store verification in session
        session['password_otp_verified'] = True
        
        return jsonify(success=True, message="OTP verified successfully"), 200
        
    except Exception as e:
        print("PASSWORD OTP VERIFICATION ERROR:", e)
        return jsonify(success=False, message="Server error"), 500

@profile_bp.route("/api/profile/change-password", methods=["POST"])
def change_password():
    try:
        from werkzeug.security import generate_password_hash
        
        data = request.get_json()
        user_id = session.get("user_id")
        otp_verified = session.get("password_otp_verified", False)
        
        if not user_id:
            return jsonify(success=False, message="Not authenticated"), 401
        
        if not otp_verified:
            return jsonify(success=False, message="Please verify OTP first"), 400
        
        new_password = data.get("new_password")
        confirm_password = data.get("confirm_password")
        
        if not new_password or not confirm_password:
            return jsonify(success=False, message="All fields are required"), 400
        
        if new_password != confirm_password:
            return jsonify(success=False, message="Passwords do not match"), 400
        
        if len(new_password) < 8:
            return jsonify(success=False, message="Password must be at least 8 characters"), 400
        
        db = get_db()
        cursor = db.cursor(dictionary=True)
        
        # Get user email
        cursor.execute("SELECT email FROM users WHERE id = %s", (user_id,))
        user = cursor.fetchone()
        
        if not user:
            return jsonify(success=False, message="User not found"), 404
        
        # Update password
        hashed = bcrypt.hashpw(new_password.encode(), bcrypt.gensalt())
        cursor.execute("UPDATE users SET password = %s WHERE id = %s", (hashed, user_id))
        
        # Delete used OTP
        cursor.execute(
            "DELETE FROM otp_data WHERE email = %s AND purpose = 'password_change'",
            (user['email'],)
        )
        
        db.commit()
        cursor.close()
        db.close()
        
        # Clear verification from session
        session.pop('password_otp_verified', None)
        
        return jsonify(success=True, message="Password changed successfully"), 200
        
    except Exception as e:
        print("PASSWORD CHANGE ERROR:", e)
        return jsonify(success=False, message="Server error"), 500
