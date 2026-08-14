import os
import sqlite3
import re
from datetime import datetime

# Environment variables for MySQL
MYSQLHOST = os.getenv("MYSQLHOST")
MYSQLUSER = os.getenv("MYSQLUSER")
MYSQLPASSWORD = os.getenv("MYSQLPASSWORD")
MYSQLDATABASE = os.getenv("MYSQLDATABASE")
MYSQLPORT = os.getenv("MYSQLPORT")

use_mysql = False
cnxpool = None

if MYSQLHOST and MYSQLUSER and MYSQLDATABASE:
    try:
        import mysql.connector
        from mysql.connector import pooling
        dbconfig = {
            "host": MYSQLHOST,
            "user": MYSQLUSER,
            "password": MYSQLPASSWORD or "",
            "database": MYSQLDATABASE,
            "port": int(MYSQLPORT) if MYSQLPORT else 3306
        }
        cnxpool = pooling.MySQLConnectionPool(
            pool_name="mypool",
            pool_size=5,
            **dbconfig
        )
        use_mysql = True
        print("Connected to MySQL database pool.")
    except Exception as e:
        print(f"MySQL connection failed: {e}. Falling back to SQLite.")
        use_mysql = False

# SQLite Fallback Wrapper
DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "cattle_cloud.db")

def init_sqlite_functions(conn):
    def curdate():
        return datetime.now().strftime("%Y-%m-%d")
    def now():
        return datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    def month(date_str):
        if not date_str: return None
        if isinstance(date_str, datetime): return date_str.month
        try:
            return datetime.strptime(str(date_str).split()[0], "%Y-%m-%d").month
        except:
            return None
    def year(date_str):
        if not date_str: return None
        if isinstance(date_str, datetime): return date_str.year
        try:
            return datetime.strptime(str(date_str).split()[0], "%Y-%m-%d").year
        except:
            return None
    def concat(*args):
        return "".join(str(a) for a in args if a is not None)

    conn.create_function("CURDATE", 0, curdate)
    conn.create_function("NOW", 0, now)
    conn.create_function("MONTH", 1, month)
    conn.create_function("YEAR", 1, year)
    conn.create_function("CONCAT", -1, concat)

class SQLiteCursorWrapper:
    def __init__(self, sqlite_cursor, dictionary=False):
        self._cursor = sqlite_cursor
        self._dictionary = dictionary

    def execute(self, query, params=None):
        q = query
        # Translate MySQL specific date functions
        q = re.sub(r'DATE_SUB\s*\(\s*CURDATE\s*\(\s*\)\s*,\s*INTERVAL\s+(\d+)\s+DAY\s*\)', r"date('now', '-\1 day')", q, flags=re.IGNORECASE)
        q = re.sub(r'DATE_SUB\s*\(\s*([^\,]+)\s*,\s*INTERVAL\s+(\d+)\s+DAY\s*\)', r"date(\1, '-\2 day')", q, flags=re.IGNORECASE)

        q = re.sub(r'NOW\(\)\s*-\s*INTERVAL\s+(\d+)\s+MINUTE', r"datetime('now', '-\1 minute')", q, flags=re.IGNORECASE)
        
        # Replace %s parameter placeholder with ?
        q = re.sub(r'%s', '?', q)

        if params is None or len(params) == 0:
            self._cursor.execute(q)
        else:
            converted_params = []
            for p in params:
                if hasattr(p, 'strftime'):
                    if hasattr(p, 'hour') and (p.hour != 0 or p.minute != 0 or p.second != 0):
                        converted_params.append(p.strftime('%Y-%m-%d %H:%M:%S'))
                    else:
                        converted_params.append(p.strftime('%Y-%m-%d'))
                else:
                    converted_params.append(p)
            self._cursor.execute(q, tuple(converted_params))
        return self


    def fetchone(self):
        row = self._cursor.fetchone()
        if row is None:
            return None
        if self._dictionary:
            cols = [d[0] for d in self._cursor.description]
            return dict(zip(cols, row))
        return row

    def fetchall(self):
        rows = self._cursor.fetchall()
        if not rows:
            return []
        if self._dictionary:
            cols = [d[0] for d in self._cursor.description]
            return [dict(zip(cols, r)) for r in rows]
        return rows

    @property
    def lastrowid(self):
        return self._cursor.lastrowid

    @property
    def rowcount(self):
        return self._cursor.rowcount

    def close(self):
        self._cursor.close()

class SQLiteConnectionWrapper:
    def __init__(self, conn):
        self._conn = conn
        init_sqlite_functions(self._conn)

    def cursor(self, dictionary=False):
        return SQLiteCursorWrapper(self._conn.cursor(), dictionary=dictionary)

    def commit(self):
        self._conn.commit()

    def rollback(self):
        self._conn.rollback()

    def close(self):
        self._conn.close()

def get_db():
    if use_mysql and cnxpool:
        try:
            return cnxpool.get_connection()
        except Exception as e:
            print(f"Failed to get MySQL connection from pool: {e}. Using SQLite fallback.")
    
    conn = sqlite3.connect(DB_PATH)
    return SQLiteConnectionWrapper(conn)

