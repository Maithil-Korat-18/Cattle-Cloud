import os
from flask import Flask, render_template, redirect, session, request, url_for, jsonify
from flask_cors import CORS
from login import auth
from dashboard import dashboard_bp
from datetime import timedelta,datetime
from cattle import cattle_bp
from records import records_bp
from home import home_bp
from profile import profile_bp


app = Flask(__name__)
app.secret_key = "super_secret_key_123"
app.register_blueprint(auth)
app.register_blueprint(dashboard_bp)
app.register_blueprint(cattle_bp)
app.register_blueprint(records_bp)
app.register_blueprint(home_bp)
app.register_blueprint(profile_bp)
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

# Dummy user data

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

##@app.route('/home')
##def home():
##    """Home page - requires authentication"""
##    if 'user_id' not in session:
##        return redirect(url_for('login'))
##    
##    return render_template('home.html')
##
# Add these routes for form submissions that the dashboard expects:
##@app.route('/dashboard')
##def dashboard():
##    if 'user_id' not in session:
##        return redirect('/login')
##    
##    stats = calculate_dashboard_stats()
##    
##    return render_template('dashboard.html',
##                         username=session.get('username', 'User'),
##                         stats=stats,
##                         cattle_list=CATTLE_LIST)


##@app.route('/cattle/<cattle_id>')
##def cattle_detail(cattle_id):
##    if 'user_id' not in session:
##        return redirect('/login')
##    
##    cattle = next((c for c in CATTLE_LIST if c['id'] == cattle_id), None)
##    
##    if not cattle:
##        return redirect('/dashboard')
##    
##    # Default: Last 7 days
##    last_7_days = cattle['milk_history'][-7:]
##    avg_milk = sum([record['quantity'] for record in last_7_days]) / len(last_7_days)
##    
##    return render_template('cattle_detail.html',
##                         username=session.get('username', 'User'),
##                         cattle=cattle,
##                         default_history=last_7_days,
##                         avg_milk=round(avg_milk, 1))
##

##
##@app.route('/api/cattle/<cattle_id>/filter', methods=['POST'])
##def filter_cattle_data(cattle_id):
##    if 'user_id' not in session:
##        return jsonify({'success': False}), 401
##    
##    cattle = next((c for c in CATTLE_LIST if c['id'] == cattle_id), None)
##    if not cattle:
##        return jsonify({'success': False, 'message': 'Cattle not found'}), 404
##    
##    data = request.get_json()
##    view_type = data.get('view_type')  # 'last_7', 'all_time', 'custom'
##    
##    if view_type == 'last_7':
##        filtered_history = cattle['milk_history'][-7:]
##    elif view_type == 'all_time':
##        filtered_history = cattle['milk_history']
##    elif view_type == 'custom':
##        start_date = data.get('start_date')
##        end_date = data.get('end_date')
##        filtered_history = [
##            record for record in cattle['milk_history']
##            if start_date <= record['date'] <= end_date
##        ]
##    else:
##        return jsonify({'success': False, 'message': 'Invalid view type'}), 400
##    
##    # Calculate statistics
##    if filtered_history:
##        avg_milk = sum([record['quantity'] for record in filtered_history]) / len(filtered_history)
##        total_milk = sum([record['quantity'] for record in filtered_history])
##        highest_day = max(filtered_history, key=lambda x: x['quantity'])
##    else:
##        avg_milk = 0
##        total_milk = 0
##        highest_day = {'date': 'N/A', 'quantity': 0}
##    
##    return jsonify({
##        'success': True,
##        'data': {
##            'history': filtered_history,
##            'avg_milk': round(avg_milk, 1),
##            'total_milk': total_milk,
##            'highest_day': highest_day,
##            'record_count': len(filtered_history)
##        }
##    })

##@app.route('/add-milk', methods=['POST'])
##def add_milk():
##    if "user_id" not in session:
##        return jsonify({"success": False, "message": "Not authenticated"}), 401
##    
##    data = request.get_json()
##    # Add your logic to save milk record to database
##    # For now, just return success
##    return jsonify({
##        "success": True,
##        "message": "Milk record added successfully"
##    })

##@app.route('/add-expense', methods=['POST'])
##def add_expense():
##    if "user_id" not in session:
##        return jsonify({"success": False, "message": "Not authenticated"}), 401
##    
##    data = request.get_json()
##    # Add your logic to save expense to database
##    return jsonify({
##        "success": True,
##        "message": "Expense added successfully"
##    })
##
##@app.route('/add-cattle', methods=['POST'])
##def add_cattle():
##    if "user_id" not in session:
##        return jsonify({"success": False, "message": "Not authenticated"}), 401
##    
##    data = request.get_json()
##    # Add your logic to save cattle to database
##    return jsonify({
##        "success": True,
##        "message": "Cattle added successfully"
##    })
##
##@app.route('/delete-cattle/<cattle_id>', methods=['DELETE'])
##def delete_cattle(cattle_id):
##    if "user_id" not in session:
##        return jsonify({"success": False, "message": "Not authenticated"}), 401
##    
##    # Add your logic to delete cattle from database
##    return jsonify({
##        "success": True,
##        "message": f"Cattle {cattle_id} deleted successfully"
##    })
##@app.route('/api/record-milk', methods=['POST'])
##def record_milk():
##    if 'user_id' not in session:
##        return jsonify({'success': False}), 401
##    return jsonify({'success': True, 'message': 'Milk record added successfully'})


##@app.route("/dashboard")
##def dashboard():
##    if "user_id" not in session:
##        return redirect("/login")
##    return render_template("dashboard.html",
##                         username=session.get('full_name', 'User'),
##                         data=CATTLE_DATA)
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
        return redirect(url_for('home'))
    return render_template('login.html')


@app.route('/records')
def records():
    if 'user_id' not in session:
        return redirect('/login')
    return render_template('records.html')


@app.route("/")
def home():
    if "user_id" in session:
        return redirect("/home")
    return render_template("landing.html")

##@app.route("/home")
##def user_home():
##    return render_template("home.html", 
##                         username=session.get('full_name', 'User'),data=CATTLE_DATA)

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
