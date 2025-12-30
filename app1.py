from flask import Flask, render_template, redirect, session
from flask_cors import CORS
from login import auth

app = Flask(__name__)
app.secret_key = "super_secret_key_123"
app.config.update(
    SESSION_COOKIE_HTTPONLY=True,
    SESSION_COOKIE_SAMESITE="Lax",  # VERY IMPORTANT
    SESSION_COOKIE_SECURE=False    # MUST be False for localhost
)


CORS(
    app,
    supports_credentials=True,
    origins=["http://127.0.0.1:5000"]
)

app.register_blueprint(auth)

@app.route("/")
def home():
    return render_template("dashboard.html")

@app.route("/dashboard")
def dashboard():
    return render_template("dashboard.html")


@app.route("/login")
def login_page():
    return render_template("index.html")


@app.route("/logout")
def logout():
    session.clear()
    return redirect("/")
@app.route("/debug-session")
def debug_session():
    return dict(session)

if __name__ == "__main__":
    app.run(debug=True)
