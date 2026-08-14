import sqlite3
import os
import bcrypt
from datetime import datetime, timedelta

def init_and_seed_db():
    print("=" * 60)
    print("Initializing Database & Seeding Initial Data for Cattle Cloud")
    print("=" * 60)

    from db import get_db

    conn = get_db()
    cur = conn.cursor()

    # Create Tables
    tables_sql = [
        """
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            full_name TEXT NOT NULL,
            email TEXT NOT NULL UNIQUE,
            phone TEXT DEFAULT NULL,
            password TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        """,
        """
        CREATE TABLE IF NOT EXISTS cattle (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            tag_no TEXT DEFAULT NULL,
            name TEXT DEFAULT NULL,
            breed TEXT DEFAULT NULL,
            age INTEGER DEFAULT NULL,
            gender TEXT DEFAULT 'Female',
            health TEXT DEFAULT 'Good',
            purchase_date DATE DEFAULT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
        );
        """,
        """
        CREATE TABLE IF NOT EXISTS expenses (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            date DATE DEFAULT NULL,
            category TEXT DEFAULT NULL,
            description TEXT DEFAULT NULL,
            amount DECIMAL(8,2) DEFAULT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users (id)
        );
        """,
        """
        CREATE TABLE IF NOT EXISTS feed_stock (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            feed_name TEXT DEFAULT NULL,
            quantity DECIMAL(8,2) DEFAULT NULL,
            min_quantity DECIMAL(8,2) DEFAULT NULL,
            cost_per_kg DECIMAL(6,2) DEFAULT NULL,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
        );
        """,
        """
        CREATE TABLE IF NOT EXISTS feed_usage (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            feed_id INTEGER NOT NULL,
            cattle_id INTEGER DEFAULT NULL,
            quantity_used DECIMAL(10,2) NOT NULL,
            usage_date DATE NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        """,
        """
        CREATE TABLE IF NOT EXISTS health_records (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            cattle_id INTEGER NOT NULL,
            issue TEXT DEFAULT NULL,
            treatment TEXT DEFAULT NULL,
            vet_name TEXT DEFAULT NULL,
            next_checkup DATE DEFAULT NULL,
            treatment_cost DECIMAL(10,2) NOT NULL DEFAULT 0.00,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users (id),
            FOREIGN KEY (cattle_id) REFERENCES cattle (id)
        );
        """,
        """
        CREATE TABLE IF NOT EXISTS milk_records (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            cattle_id INTEGER NOT NULL,
            date DATE NOT NULL,
            morning_liters DECIMAL(5,2) DEFAULT 0.00,
            evening_liters DECIMAL(5,2) DEFAULT 0.00,
            milk_liters DECIMAL(5,2) GENERATED ALWAYS AS (morning_liters + evening_liters) STORED,
            rate DECIMAL(6,2) NOT NULL,
            income DECIMAL(8,2) DEFAULT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
            FOREIGN KEY (cattle_id) REFERENCES cattle (id) ON DELETE CASCADE
        );
        """,
        """
        CREATE TABLE IF NOT EXISTS notifications (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            type TEXT DEFAULT NULL,
            message TEXT DEFAULT NULL,
            is_read INTEGER DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users (id)
        );
        """,
        """
        CREATE TABLE IF NOT EXISTS otp_data (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            email TEXT NOT NULL,
            otp TEXT NOT NULL,
            purpose TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        """
    ]

    for stmt in tables_sql:
        cur.execute(stmt)
    conn.commit()
    print("[OK] Database tables initialized successfully.")


    # Create 2 test users
    password_plain = "Password123"
    hashed_pw = bcrypt.hashpw(password_plain.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

    users_data = [
        {"id": 1, "name": "John Farmer", "email": "user1@cattlecloud.com", "phone": "9876543210"},
        {"id": 2, "name": "Sarah Miller", "email": "user2@cattlecloud.com", "phone": "9876543211"}
    ]

    for u in users_data:
        cur.execute("SELECT id FROM users WHERE email=%s", (u["email"],))
        existing = cur.fetchone()
        if not existing:
            cur.execute("""
                INSERT INTO users (id, full_name, email, phone, password)
                VALUES (%s, %s, %s, %s, %s)
            """, (u["id"], u["name"], u["email"], u["phone"], hashed_pw))
            print(f"[OK] User created: {u['email']} (Name: {u['name']})")
        else:
            # Update password hash to make sure it matches
            cur.execute("UPDATE users SET password=%s WHERE email=%s", (hashed_pw, u["email"]))
            print(f"[OK] User already exists: {u['email']} (Password reset to '{password_plain}')")


    conn.commit()

    # Seed data for User 1
    seed_user_data(conn, user_id=1, user_prefix="U1", cattle_list=[
        {"name": "Luna", "breed": "Gir", "age": 5, "gender": "Female", "health": "Good", "tag": "C01"},
        {"name": "Bella", "breed": "Jersey", "age": 4, "gender": "Female", "health": "Good", "tag": "C02"},
        {"name": "Daisy", "breed": "Holstein", "age": 6, "gender": "Female", "health": "Fair", "tag": "C03"}
    ])

    # Seed data for User 2
    seed_user_data(conn, user_id=2, user_prefix="U2", cattle_list=[
        {"name": "Molly", "breed": "Sahiwal", "age": 4, "gender": "Female", "health": "Good", "tag": "C04"},
        {"name": "Rosie", "breed": "Red Sindhi", "age": 3, "gender": "Female", "health": "Good", "tag": "C05"},
        {"name": "Clara", "breed": "Holstein", "age": 5, "gender": "Female", "health": "Fair", "tag": "C06"}
    ])

    cur.close()
    conn.close()
    print("=" * 60)
    print("Data Seeding Complete!")
    print("=" * 60)

def seed_user_data(conn, user_id, user_prefix, cattle_list):
    cur = conn.cursor(dictionary=True)
    today = datetime.now().date()

    # 1. Cattle
    cattle_ids = []
    for c in cattle_list:
        cur.execute("SELECT id FROM cattle WHERE user_id=%s AND tag_no=%s", (user_id, c["tag"]))
        row = cur.fetchone()
        if not row:
            p_date = (today - timedelta(days=365)).strftime('%Y-%m-%d')
            cur.execute("""
                INSERT INTO cattle (user_id, tag_no, name, breed, age, gender, health, purchase_date)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
            """, (user_id, c["tag"], c["name"], c["breed"], c["age"], c["gender"], c["health"], p_date))
            cattle_ids.append(cur.lastrowid)
        else:
            cattle_ids.append(row["id"])

    # 2. Milk Records for the past 14 days
    rate = 45.0
    for i in range(14):
        rec_date = today - timedelta(days=i)
        for cid in cattle_ids:
            cur.execute("SELECT id FROM milk_records WHERE user_id=%s AND cattle_id=%s AND date=%s", (user_id, cid, rec_date))
            if not cur.fetchone():
                morning = 7.5 + (cid * 0.5) + (i % 3) * 0.2
                evening = 6.5 + (cid * 0.4) + (i % 2) * 0.3
                tot = morning + evening
                inc = tot * rate
                cur.execute("""
                    INSERT INTO milk_records (user_id, cattle_id, date, morning_liters, evening_liters, rate, income)
                    VALUES (%s, %s, %s, %s, %s, %s, %s)
                """, (user_id, cid, rec_date, morning, evening, rate, inc))

    # 3. Feed Stock
    feeds = [
        {"name": "Green Fodder", "qty": 350.0, "min_qty": 50.0, "cost": 12.0},
        {"name": "Dry Fodder", "qty": 400.0, "min_qty": 60.0, "cost": 10.0},
        {"name": "Wheat Bran", "qty": 200.0, "min_qty": 30.0, "cost": 25.0},
        {"name": "Concentrate Feed", "qty": 150.0, "min_qty": 25.0, "cost": 40.0}
    ]
    feed_ids = {}
    for f in feeds:
        cur.execute("SELECT id FROM feed_stock WHERE user_id=%s AND feed_name=%s", (user_id, f["name"]))
        row = cur.fetchone()
        if not row:
            cur.execute("""
                INSERT INTO feed_stock (user_id, feed_name, quantity, min_quantity, cost_per_kg)
                VALUES (%s, %s, %s, %s, %s)
            """, (user_id, f["name"], f["qty"], f["min_qty"], f["cost"]))
            feed_ids[f["name"]] = cur.lastrowid
        else:
            feed_ids[f["name"]] = row["id"]

    # 4. Feed Usage for past 7 days
    for i in range(7):
        u_date = today - timedelta(days=i)
        for cid in cattle_ids:
            for fname, fid in feed_ids.items():
                cur.execute("SELECT id FROM feed_usage WHERE user_id=%s AND cattle_id=%s AND feed_id=%s AND usage_date=%s", (user_id, cid, fid, u_date))
                if not cur.fetchone():
                    qty = 4.0 if "Fodder" in fname else 1.5
                    cur.execute("""
                        INSERT INTO feed_usage (user_id, feed_id, cattle_id, quantity_used, usage_date)
                        VALUES (%s, %s, %s, %s, %s)
                    """, (user_id, fid, cid, qty, u_date))

    # 5. Expenses
    expense_samples = [
        {"cat": "Feed", "desc": "Purchased Green Fodder Stock", "amt": 2400.00, "days_ago": 10},
        {"cat": "Health", "desc": "Routine Vaccination & Health Checkup", "amt": 850.00, "days_ago": 7},
        {"cat": "Equipment", "desc": "Milking Machine Maintenance", "amt": 1200.00, "days_ago": 5},
        {"cat": "Utilities", "desc": "Water and Electricity Bill for Barn", "amt": 650.00, "days_ago": 3}
    ]
    for exp in expense_samples:
        exp_date = today - timedelta(days=exp["days_ago"])
        cur.execute("SELECT id FROM expenses WHERE user_id=%s AND description=%s AND date=%s", (user_id, exp["desc"], exp_date))
        if not cur.fetchone():
            cur.execute("""
                INSERT INTO expenses (user_id, date, category, description, amount)
                VALUES (%s, %s, %s, %s, %s)
            """, (user_id, exp_date, exp["cat"], exp["desc"], exp["amt"]))

    # 6. Health Records
    if cattle_ids:
        cid = cattle_ids[0]
        cur.execute("SELECT id FROM health_records WHERE user_id=%s AND cattle_id=%s", (user_id, cid))
        if not cur.fetchone():
            cur.execute("""
                INSERT INTO health_records (user_id, cattle_id, issue, treatment, vet_name, next_checkup, treatment_cost)
                VALUES (%s, %s, %s, %s, %s, %s, %s)
            """, (user_id, cid, "Seasonal Fever", "Antibiotics and Rest", "Dr. Robert Smith", (today + timedelta(days=14)).strftime('%Y-%m-%d'), 450.00))

    conn.commit()
    cur.close()

if __name__ == "__main__":
    init_and_seed_db()
