from flask import Flask, render_template, redirect, session, request
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

@app.route("/")
def home():
    print(f"Home route - Session: {dict(session)}")
    return render_template("dashboard.html")

@app.route("/dashboard")
def dashboard():
    print(f"Dashboard route - Session: {dict(session)}")
    if "user_id" not in session:
        print("No user_id in session, redirecting to login")
        return redirect("/login")
    return render_template("dashboard.html")

@app.route("/login")
def login_page():
    if "user_id" in session:
        print("User already logged in, redirecting to dashboard")
        return redirect("/dashboard")
    return render_template("index.html")

@app.route("/logout")
def logout():
    print(f"Logout - Clearing session: {dict(session)}")
    session.clear()
    return redirect("/")

@app.route("/chatbot")
def chatbot():
    return render_template("chatbot1.html")
if __name__ == "__main__":
    app.run(debug=True, host='127.0.0.1', port=5000)
