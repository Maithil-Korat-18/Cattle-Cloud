import os
from flask import Flask, render_template, redirect, session, request, url_for, jsonify
from flask_cors import CORS
from login import auth
from dashboard import dashboard_bp
from datetime import timedelta,datetime
from cattle import cattle_bp
from home import home_bp
from profile import profile_bp
from cattle_detail import cattle_detail_bp
from milk_records import milk_bp
from feed import feed_bp
from expenses import expenses_bp

app = Flask(__name__)
app.secret_key = "super_secret_key_123"
app.register_blueprint(auth)
app.register_blueprint(dashboard_bp)
app.register_blueprint(cattle_bp)
app.register_blueprint(home_bp)
app.register_blueprint(profile_bp)
app.register_blueprint(cattle_detail_bp)
app.register_blueprint(milk_bp)
app.register_blueprint(feed_bp)
app.register_blueprint(expenses_bp)
# ✅ IMPORTANT: Session configuration
app.config.update(
    SESSION_COOKIE_NAME='session',
    SESSION_COOKIE_HTTPONLY=True,
    SESSION_COOKIE_SAMESITE='Lax',
    SESSION_COOKIE_SECURE=False,  # False for localhost
    PERMANENT_SESSION_LIFETIME=timedelta(days=7)
)

@app.route('/login', methods=['GET', 'POST'])
def login():
    """Login page and authentication"""
    if request.method == 'POST':
        user_id = request.form.get('user_id')
        password = request.form.get('password')
        
        if user_id in USERS and USERS[user_id] == password:
            session['user_id'] = user_id
            session['login_time'] = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
            return redirect(url_for('home'))
        else:
            return render_template('login.html', error='Invalid credentials')
    
    if 'user_id' in session:
        return redirect("/dashboard")
    return render_template('login.html')


@app.route('/records')
def records():
    if 'user_id' not in session:
        return redirect('/login')
    return render_template('records.html')


@app.route("/")
def home():
    if "user_id" in session:
        return redirect("/dashboard")
    return render_template("landing.html")


@app.route("/profile")
def profile():
    if "user_id" not in session:
        return redirect("/login")
    
    user_info = {
        'username': session.get('full_name', 'User'),
        'email': session.get('email', 'N/A'),
        'role': 'Farm Manager',
        'joined': '2023-06-15',
        'login_time': 'Recently'
    }
    return render_template("profile.html", user=user_info)

@app.route("/about")
def about():
    return render_template("about.html")

@app.route("/contact")
def contact():
    return render_template("contact.html")

@app.route("/breeds")
def breeds():
    return render_template("breeds.html")

@app.route("/logout")
def logout():
    print(f"Logout - Clearing session: {dict(session)}")
    session.clear()
    return redirect("/")



if __name__ == "__main__":
    app.run(debug=True, host='127.0.0.1', port=5000)
