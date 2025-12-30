import smtplib
import ssl
from email.message import EmailMessage

GMAIL_USER = "cattlesense1@gmail.com"
GMAIL_APP_PASSWORD = "xirircqdvonlixtv"


def send_otp_email(email, otp, purpose="registration"):
    msg = EmailMessage()
    msg["From"] = GMAIL_USER
    msg["To"] = email

    if purpose == "registration":
        subject = "Email Verification - Registration"
        color = "#667eea"
        title = "🔐 Email Verification"
        message = "Thank you for registering! Use the OTP below to verify your email."
    else:
        subject = "Password Reset Code"
        color = "#f5576c"
        title = "🔑 Password Reset"
        message = "Use the OTP below to reset your password."

    msg["Subject"] = subject

    html = f"""
    <html>
    <body style="font-family:Arial;background:#f4f4f4;padding:30px;">
        <div style="max-width:600px;margin:auto;background:#fff;border-radius:10px;padding:30px;">
            <h2 style="color:{color};text-align:center">{title}</h2>
            <p>{message}</p>

            <div style="
                font-size:32px;
                letter-spacing:6px;
                font-weight:bold;
                color:{color};
                border:2px dashed {color};
                padding:20px;
                text-align:center;
                margin:30px 0;
            ">
                {otp}
            </div>

            <p>This OTP is valid for <b>10 minutes</b>.</p>
            <p style="color:red">Do not share this code with anyone.</p>

            <hr>
            <small>© 2025 ACME</small>
        </div>
    </body>
    </html>
    """

    msg.add_alternative(html, subtype="html")

    try:
        context = ssl.create_default_context()
        with smtplib.SMTP_SSL("smtp.gmail.com", 465, context=context) as server:
            server.login(GMAIL_USER, GMAIL_APP_PASSWORD)
            server.send_message(msg)
        return True
    except Exception as e:
        print("EMAIL ERROR:", e)
        return False
