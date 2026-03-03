import os
import mysql.connector
from mysql.connector import pooling

dbconfig = {
    "host": os.getenv("MYSQLHOST"),
    "user": os.getenv("MYSQLUSER"),
    "password": os.getenv("MYSQLPASSWORD"),
    "database": os.getenv("MYSQLDATABASE"),
    "port": int(os.getenv("MYSQLPORT"))
}

cnxpool = pooling.MySQLConnectionPool(
    pool_name="mypool",
    pool_size=5,
    **dbconfig
)

def get_db():
    return cnxpool.get_connection()
