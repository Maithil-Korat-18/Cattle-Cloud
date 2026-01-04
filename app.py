
import os
from flask import Flask, render_template, redirect, session, request, url_for, jsonify
from flask_cors import CORS
from login import auth
from datetime import timedelta

app = Flask(__name__)
app.secret_key = "super_secret_key_123"

# ✅ IMPORTANT: Session configuration
app.config.update(
    SESSION_COOKIE_NAME='session',
    SESSION_COOKIE_HTTPONLY=True,
    SESSION_COOKIE_SAMESITE='Lax',
    SESSION_COOKIE_SECURE=False,  # False for localhost
    PERMANENT_SESSION_LIFETIME=timedelta(days=7)
)

# ✅ REMOVE CORS - Not needed when serving from same origin
# When your API and frontend are on the same Flask server, you don't need CORS

app.register_blueprint(auth)

# Dummy user data
USERS = {
    'admin': 'admin123',
    'farmer': 'farmer123'
}

# Dummy cattle data
CATTLE_DATA = {
    'total_cattle': 45,
    'milk_this_week': 1250,
    'monthly_average': 5200,
    'health_alerts': 3,
    'weekly_milk': [180, 175, 182, 178, 185, 175, 180],
    'monthly_milk': [5100, 5300, 5200, 5400, 5000, 5200],
    'cattle_list': [
        {'id': 'C001', 'name': 'Bella', 'breed': 'Holstein', 'age': 4, 'health': 'Good', 'milk_today': 28},
        {'id': 'C002', 'name': 'Daisy', 'breed': 'Jersey', 'age': 3, 'health': 'Excellent', 'milk_today': 22},
        {'id': 'C003', 'name': 'Luna', 'breed': 'Holstein', 'age': 5, 'health': 'Fair', 'milk_today': 25},
        {'id': 'C004', 'name': 'Rosie', 'breed': 'Guernsey', 'age': 4, 'health': 'Good', 'milk_today': 20},
        {'id': 'C005', 'name': 'Molly', 'breed': 'Holstein', 'age': 6, 'health': 'Good', 'milk_today': 30},
    ],
    'health_records': [
        {'cattle_id': 'C001', 'date': '2024-01-02', 'issue': 'Routine Checkup', 'status': 'Completed'},
        {'cattle_id': 'C003', 'date': '2024-01-03', 'issue': 'Mild Fever', 'status': 'Under Treatment'},
        {'cattle_id': 'C004', 'date': '2024-01-01', 'issue': 'Vaccination', 'status': 'Completed'},
    ],
    'feed_records': [
        {'date': '2024-01-04', 'type': 'Hay', 'quantity': '500 kg', 'cost': '$250'},
        {'date': '2024-01-03', 'type': 'Grain Mix', 'quantity': '200 kg', 'cost': '$180'},
        {'date': '2024-01-02', 'type': 'Silage', 'quantity': '300 kg', 'cost': '$150'},
    ]
}
@app.route('/login', methods=['GET', 'POST'])
def login():
    """Login page and authentication"""
    if request.method == 'POST':
        user_id = request.form.get('user_id')
        password = request.form.get('password')
        
        if username in USERS and USERS[username] == password:
            session['user_id'] = username
            session['login_time'] = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
            return redirect(url_for('home'))
        else:
            return render_template('login.html', error='Invalid credentials')
    
    if 'user_id' in session:
        return redirect(url_for('home'))
    
    return render_template('login.html')

##@app.route('/home')
##def home():
##    """Home page - requires authentication"""
##    if 'user_id' not in session:
##        return redirect(url_for('login'))
##    
##    return render_template('home.html')
##


@app.route("/")
def home():
    if "user_id" in session:
        return redirect("/home")
    return render_template("landing.html")

@app.route("/home")
def user_home():
    return render_template("home.html", 
                         username=session.get('full_name', 'User'),
                         data=CATTLE_DATA)


@app.route("/dashboard")
def dashboard():
    if "user_id" not in session:
        return redirect("/login")
    return render_template("dashboard.html",
                         username=session.get('full_name', 'User'),
                         data=CATTLE_DATA)

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
