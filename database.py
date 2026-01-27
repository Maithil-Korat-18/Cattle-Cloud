"""
database.py - Database configuration and connection management
This file handles MySQL database connections using connection pooling
"""

import mysql.connector
from mysql.connector import pooling
from mysql.connector import Error

# Database configuration
DB_CONFIG = {
    'host': 'localhost',
    'user': 'root',
    'password': '',  # Add your MySQL password here
    'database': 'cattle_management'
}

# Create connection pool for better performance
# Pool allows multiple requests to reuse database connections
connection_pool = None

def initialize_pool():
    """
    Initialize MySQL connection pool
    This is called once when the application starts
    """
    global connection_pool
    try:
        connection_pool = pooling.MySQLConnectionPool(
            pool_name="cattle_pool",
            pool_size=5,  # Number of connections in the pool
            pool_reset_session=True,
            **DB_CONFIG
        )
        print("✅ Connection pool created successfully")
    except Error as e:
        print(f"❌ Error creating connection pool: {e}")
        connection_pool = None

def get_connection():
    """
    Get a database connection from the pool
    Returns a MySQL connection object
    Usage: conn = get_connection()
    """
    try:
        if connection_pool is None:
            initialize_pool()
        return connection_pool.get_connection()
    except Error as e:
        print(f"❌ Error getting connection from pool: {e}")
        return None

def close_connection(connection, cursor=None):
    """
    Close database connection and cursor
    Always call this after database operations
    
    Args:
        connection: MySQL connection object
        cursor: MySQL cursor object (optional)
    """
    try:
        if cursor:
            cursor.close()
        if connection and connection.is_connected():
            connection.close()
    except Error as e:
        print(f"❌ Error closing connection: {e}")

def execute_query(query, params=None, fetch=False):
    """
    Execute a SQL query with automatic connection management
    
    Args:
        query: SQL query string
        params: Tuple of parameters for the query (prevents SQL injection)
        fetch: If True, returns query results; If False, commits changes
    
    Returns:
        If fetch=True: List of rows
        If fetch=False: Number of affected rows
    """
    connection = get_connection()
    if not connection:
        return None
    
    cursor = None
    try:
        cursor = connection.cursor(dictionary=True)  # Returns results as dictionaries
        cursor.execute(query, params or ())
        
        if fetch:
            result = cursor.fetchall()
            return result
        else:
            connection.commit()
            return cursor.rowcount
    except Error as e:
        print(f"❌ Database error: {e}")
        if not fetch:
            connection.rollback()
        return None
    finally:
        close_connection(connection, cursor)
