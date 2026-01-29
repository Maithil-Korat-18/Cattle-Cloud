from flask import Blueprint, render_template, request, jsonify, session, redirect, url_for
from db import get_db
from datetime import date
profile_api = Blueprint("profile_api", __name__)


@profile_api.route("/api/profile/update", methods=["POST"])
def update_profile():
    data = request.get_json()

    username = data.get("username", "").strip()
    email = data.get("email", "").strip()

    if not username or not email:
        return jsonify({
            "success": False,
            "message": "Invalid data"
        }), 400

    # Update user
    user = User.query.get(current_user.id)
    user.username = username
    user.email = email

    db.session.commit()

    # Update session (important)
    session["username"] = username

    return jsonify({
        "success": True,
        "user": {
            "username": user.username,
            "email": user.email
        }
    })
