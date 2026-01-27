import mysql.connector
from mysql.connector import pooling

dbconfig = {
    "host": "localhost",
    "user": "root",
    "password": "",
    "database": "cattle_management"
}

cnxpool = pooling.MySQLConnectionPool(
    pool_name="mypool",
    pool_size=5,
    **dbconfig
)

def get_db():
    return cnxpool.get_connection()
