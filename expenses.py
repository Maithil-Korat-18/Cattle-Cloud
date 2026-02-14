from flask import Blueprint, request, jsonify, session,render_template
from datetime import datetime, timedelta
from decimal import Decimal
import traceback
from db import get_db
expenses_bp = Blueprint('expenses', __name__)

@expenses_bp.route('/expenses')
def expense():
    return render_template('expenses.html')

def decimal_to_float(obj):
    """Convert Decimal objects to float for JSON serialization"""
    if isinstance(obj, Decimal):
        return float(obj)
    raise TypeError

# ════════════════════════════════════════════════════════════════
# GET FINANCIAL METRICS
# ════════════════════════════════════════════════════════════════
@expenses_bp.route('/api/expenses/metrics', methods=['GET'])
def get_financial_metrics():
    """Get total revenue, expenses, profit, and pending invoices"""
    try:
        user_id = session.get('user_id')
        if not user_id:
            return jsonify({'error': 'Unauthorized'}), 401
        
        # Get date range from query params or default to current month
        from_date = request.args.get('from_date')
        to_date = request.args.get('to_date')
        
        if not from_date or not to_date:
            # Default: 1st of current month to today
            today = datetime.now()
            from_date = today.replace(day=1).strftime('%Y-%m-%d')
            to_date = today.strftime('%Y-%m-%d')
        
        conn = get_db()
        if not conn:
            return jsonify({'error': 'Database connection failed'}), 500
        
        cursor = conn.cursor(dictionary=True)
        
        # Calculate total revenue from milk sales
        cursor.execute("""
            SELECT COALESCE(SUM(income), 0) as total_revenue
            FROM milk_records
            WHERE user_id = %s AND date BETWEEN %s AND %s
        """, (user_id, from_date, to_date))
        revenue_data = cursor.fetchone()
        total_revenue = float(revenue_data['total_revenue']) if revenue_data else 0.0
        
        # Calculate total expenses
        cursor.execute("""
            SELECT COALESCE(SUM(amount), 0) as total_expenses
            FROM expenses
            WHERE user_id = %s AND date BETWEEN %s AND %s
        """, (user_id, from_date, to_date))
        expense_data = cursor.fetchone()
        total_expenses = float(expense_data['total_expenses']) if expense_data else 0.0
        
        # Calculate net profit
        net_profit = total_revenue - total_expenses
        
        # Pending invoices (you can modify this logic based on your needs)
        # For now, counting recent transactions without status tracking
        cursor.execute("""
            SELECT COUNT(*) as pending_count
            FROM milk_records
            WHERE user_id = %s AND date >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)
        """, (user_id,))
        pending_data = cursor.fetchone()
        pending_invoices = pending_data['pending_count'] if pending_data else 0
        
        cursor.close()
        conn.close()
        
        return jsonify({
            'total_revenue': round(total_revenue, 2),
            'total_expenses': round(total_expenses, 2),
            'net_profit': round(net_profit, 2),
            'pending_invoices': pending_invoices,
            'date_range': {
                'from': from_date,
                'to': to_date
            }
        }), 200
        
    except Exception as e:
        print(f"Error in get_financial_metrics: {traceback.format_exc()}")
        return jsonify({'error': 'Internal server error', 'details': str(e)}), 500


# ════════════════════════════════════════════════════════════════
# GET CASH FLOW DATA (for bar chart)
# ════════════════════════════════════════════════════════════════
@expenses_bp.route('/api/expenses/cashflow', methods=['GET'])
def get_cash_flow():
    """Get revenue and expenses grouped by date for cash flow chart"""
    try:
        user_id = session.get('user_id')
        if not user_id:
            return jsonify({'error': 'Unauthorized'}), 401
        
        from_date = request.args.get('from_date')
        to_date = request.args.get('to_date')
        
        if not from_date or not to_date:
            today = datetime.now()
            from_date = today.replace(day=1).strftime('%Y-%m-%d')
            to_date = today.strftime('%Y-%m-%d')
        
        conn = get_db()
        if not conn:
            return jsonify({'error': 'Database connection failed'}), 500
        
        cursor = conn.cursor(dictionary=True)
        
        # Get revenue by date
        cursor.execute("""
            SELECT date, COALESCE(SUM(income), 0) as revenue
            FROM milk_records
            WHERE user_id = %s AND date BETWEEN %s AND %s
            GROUP BY date
            ORDER BY date
        """, (user_id, from_date, to_date))
        revenue_records = cursor.fetchall()
        
        # Get expenses by date
        cursor.execute("""
            SELECT date, COALESCE(SUM(amount), 0) as expenses
            FROM expenses
            WHERE user_id = %s AND date BETWEEN %s AND %s
            GROUP BY date
            ORDER BY date
        """, (user_id, from_date, to_date))
        expense_records = cursor.fetchall()
        
        cursor.close()
        conn.close()
        
        # Merge data by date
        date_map = {}
        
        for record in revenue_records:
            date_str = record['date'].strftime('%Y-%m-%d')
            date_map[date_str] = {
                'date': date_str,
                'revenue': float(record['revenue']),
                'expenses': 0.0
            }
        
        for record in expense_records:
            date_str = record['date'].strftime('%Y-%m-%d')
            if date_str in date_map:
                date_map[date_str]['expenses'] = float(record['expenses'])
            else:
                date_map[date_str] = {
                    'date': date_str,
                    'revenue': 0.0,
                    'expenses': float(record['expenses'])
                }
        
        # Convert to sorted list
        cash_flow_data = sorted(date_map.values(), key=lambda x: x['date'])
        
        return jsonify({
            'cash_flow': cash_flow_data,
            'date_range': {
                'from': from_date,
                'to': to_date
            }
        }), 200
        
    except Exception as e:
        print(f"Error in get_cash_flow: {traceback.format_exc()}")
        return jsonify({'error': 'Internal server error', 'details': str(e)}), 500


# ════════════════════════════════════════════════════════════════
# GET REVENUE BREAKDOWN (for pie chart)
# ════════════════════════════════════════════════════════════════
@expenses_bp.route('/api/expenses/revenue-breakdown', methods=['GET'])
def get_revenue_breakdown():
    """Get revenue breakdown by cattle for pie chart"""
    try:
        user_id = session.get('user_id')
        if not user_id:
            return jsonify({'error': 'Unauthorized'}), 401
        
        from_date = request.args.get('from_date')
        to_date = request.args.get('to_date')
        
        if not from_date or not to_date:
            today = datetime.now()
            from_date = today.replace(day=1).strftime('%Y-%m-%d')
            to_date = today.strftime('%Y-%m-%d')
        
        conn = get_db()
        if not conn:
            return jsonify({'error': 'Database connection failed'}), 500
        
        cursor = conn.cursor(dictionary=True)
        
        # Get revenue by cattle
        cursor.execute("""
            SELECT 
                c.name as cattle_name,
                COALESCE(SUM(m.income), 0) as total_income
            FROM milk_records m
            JOIN cattle c ON m.cattle_id = c.id
            WHERE m.user_id = %s AND m.date BETWEEN %s AND %s
            GROUP BY c.id, c.name
            HAVING total_income > 0
            ORDER BY total_income DESC
        """, (user_id, from_date, to_date))
        
        breakdown_data = cursor.fetchall()
        
        cursor.close()
        conn.close()
        
        # Format for pie chart
        revenue_breakdown = [
            {
                'label': record['cattle_name'],
                'value': float(record['total_income'])
            }
            for record in breakdown_data
        ]
        
        return jsonify({
            'breakdown': revenue_breakdown,
            'date_range': {
                'from': from_date,
                'to': to_date
            }
        }), 200
        
    except Exception as e:
        print(f"Error in get_revenue_breakdown: {traceback.format_exc()}")
        return jsonify({'error': 'Internal server error', 'details': str(e)}), 500


# ════════════════════════════════════════════════════════════════
# GET TRANSACTIONS (with pagination and filtering)
# ════════════════════════════════════════════════════════════════
@expenses_bp.route('/api/expenses/transactions', methods=['GET'])
def get_transactions():
    """Get all transactions (income + expenses) with pagination"""
    try:
        user_id = session.get('user_id')
        if not user_id:
            return jsonify({'error': 'Unauthorized'}), 401
        
        # Pagination params
        page = int(request.args.get('page', 1))
        per_page = int(request.args.get('per_page', 10))
        
        # Filter params
        transaction_type = request.args.get('type', 'all')  # 'all', 'income', 'expense'
        from_date = request.args.get('from_date')
        to_date = request.args.get('to_date')
        
        if not from_date or not to_date:
            today = datetime.now()
            from_date = today.replace(day=1).strftime('%Y-%m-%d')
            to_date = today.strftime('%Y-%m-%d')
        
        conn = get_db()
        if not conn:
            return jsonify({'error': 'Database connection failed'}), 500
        
        cursor = conn.cursor(dictionary=True)
        
        # Build transactions query based on filter
        transactions = []
        
        # Get income transactions
        if transaction_type in ['all', 'income']:
            cursor.execute("""
                SELECT 
                    m.date,
                    CONCAT('Milk Sale - ', c.name) as description,
                    'Milk Sales' as category,
                    m.income as amount,
                    'income' as type,
                    'paid' as status
                FROM milk_records m
                JOIN cattle c ON m.cattle_id = c.id
                WHERE m.user_id = %s 
                AND m.date BETWEEN %s AND %s
                AND m.income > 0
            """, (user_id, from_date, to_date))
            income_records = cursor.fetchall()
            transactions.extend(income_records)
        
        # Get expense transactions
        if transaction_type in ['all', 'expense']:
            cursor.execute("""
                SELECT 
                    date,
                    description,
                    category,
                    amount,
                    'expense' as type,
                    'paid' as status
                FROM expenses
                WHERE user_id = %s 
                AND date BETWEEN %s AND %s
            """, (user_id, from_date, to_date))
            expense_records = cursor.fetchall()
            transactions.extend(expense_records)
        
        # Sort by date (descending)
        transactions.sort(key=lambda x: x['date'], reverse=True)
        
        # Get total count
        total_transactions = len(transactions)
        
        # Apply pagination
        start_idx = (page - 1) * per_page
        end_idx = start_idx + per_page
        paginated_transactions = transactions[start_idx:end_idx]
        
        # Format transactions
        formatted_transactions = []
        for txn in paginated_transactions:
            formatted_transactions.append({
                'date': txn['date'].strftime('%Y-%m-%d'),
                'description': txn['description'] or 'N/A',
                'category': txn['category'],
                'amount': float(txn['amount']),
                'type': txn['type'],
                'status': txn['status']
            })
        
        cursor.close()
        conn.close()
        
        return jsonify({
            'transactions': formatted_transactions,
            'pagination': {
                'page': page,
                'per_page': per_page,
                'total': total_transactions,
                'total_pages': (total_transactions + per_page - 1) // per_page
            },
            'date_range': {
                'from': from_date,
                'to': to_date
            }
        }), 200
        
    except Exception as e:
        print(f"Error in get_transactions: {traceback.format_exc()}")
        return jsonify({'error': 'Internal server error', 'details': str(e)}), 500


# ════════════════════════════════════════════════════════════════
# ADD EXPENSE
# ════════════════════════════════════════════════════════════════
@expenses_bp.route('/api/expenses/add', methods=['POST'])
def add_expense():
    """Add a new expense"""
    try:
        user_id = session.get('user_id')
        if not user_id:
            return jsonify({'error': 'Unauthorized'}), 401
        
        data = request.get_json()
        
        # Validate required fields
        required_fields = ['date', 'category', 'description', 'amount']
        for field in required_fields:
            if field not in data or not data[field]:
                return jsonify({'error': f'Missing required field: {field}'}), 400
        
        # Validate amount
        try:
            amount = float(data['amount'])
            if amount <= 0:
                return jsonify({'error': 'Amount must be greater than 0'}), 400
        except ValueError:
            return jsonify({'error': 'Invalid amount'}), 400
        
        # Validate date format
        try:
            expense_date = datetime.strptime(data['date'], '%Y-%m-%d').date()
        except ValueError:
            return jsonify({'error': 'Invalid date format. Use YYYY-MM-DD'}), 400
        
        conn = get_db()
        if not conn:
            return jsonify({'error': 'Database connection failed'}), 500
        
        cursor = conn.cursor()
        
        # Insert expense
        cursor.execute("""
            INSERT INTO expenses (user_id, date, category, description, amount)
            VALUES (%s, %s, %s, %s, %s)
        """, (user_id, expense_date, data['category'], data['description'], amount))
        
        conn.commit()
        expense_id = cursor.lastrowid
        
        cursor.close()
        conn.close()
        
        return jsonify({
            'message': 'Expense added successfully',
            'expense_id': expense_id
        }), 201
        
    except Exception as e:
        print(f"Error in add_expense: {traceback.format_exc()}")
        return jsonify({'error': 'Internal server error', 'details': str(e)}), 500


# ════════════════════════════════════════════════════════════════
# GENERATE PDF REPORT
# ════════════════════════════════════════════════════════════════
@expenses_bp.route('/api/expenses/report-data', methods=['GET'])
def get_report_data():
    """Get comprehensive data for PDF report generation"""
    try:
        user_id = session.get('user_id')
        if not user_id:
            return jsonify({'error': 'Unauthorized'}), 401
        
        from_date = request.args.get('from_date')
        to_date = request.args.get('to_date')
        report_type = request.args.get('type', 'all')  # 'all', 'income', 'expense'
        
        if not from_date or not to_date:
            return jsonify({'error': 'Date range required'}), 400
        
        conn = get_db()
        if not conn:
            return jsonify({'error': 'Database connection failed'}), 500
        
        cursor = conn.cursor(dictionary=True)
        
        transactions = []
        
        # Get income data
        if report_type in ['all', 'income']:
            cursor.execute("""
                SELECT 
                    m.date,
                    CONCAT('Milk Sale - ', c.name) as description,
                    'Milk Sales' as category,
                    m.income as amount,
                    'income' as type
                FROM milk_records m
                JOIN cattle c ON m.cattle_id = c.id
                WHERE m.user_id = %s 
                AND m.date BETWEEN %s AND %s
                AND m.income > 0
                ORDER BY m.date DESC
            """, (user_id, from_date, to_date))
            income_records = cursor.fetchall()
            transactions.extend(income_records)
        
        # Get expense data
        if report_type in ['all', 'expense']:
            cursor.execute("""
                SELECT 
                    date,
                    description,
                    category,
                    amount,
                    'expense' as type
                FROM expenses
                WHERE user_id = %s 
                AND date BETWEEN %s AND %s
                ORDER BY date DESC
            """, (user_id, from_date, to_date))
            expense_records = cursor.fetchall()
            transactions.extend(expense_records)
        
        # Calculate summary
        total_income = sum(float(t['amount']) for t in transactions if t['type'] == 'income')
        total_expense = sum(float(t['amount']) for t in transactions if t['type'] == 'expense')
        net_profit = total_income - total_expense
        
        # Format transactions
        formatted_transactions = []
        for txn in sorted(transactions, key=lambda x: x['date'], reverse=True):
            formatted_transactions.append({
                'date': txn['date'].strftime('%Y-%m-%d'),
                'description': txn['description'] or 'N/A',
                'category': txn['category'],
                'amount': float(txn['amount']),
                'type': txn['type']
            })
        
        cursor.close()
        conn.close()
        
        return jsonify({
            'transactions': formatted_transactions,
            'summary': {
                'total_income': round(total_income, 2),
                'total_expense': round(total_expense, 2),
                'net_profit': round(net_profit, 2),
                'transaction_count': len(formatted_transactions)
            },
            'date_range': {
                'from': from_date,
                'to': to_date
            },
            'report_type': report_type
        }), 200
        
    except Exception as e:
        print(f"Error in get_report_data: {traceback.format_exc()}")
        return jsonify({'error': 'Internal server error', 'details': str(e)}), 500
    
    # Add this delete endpoint to your existing expenses_routes.py file

@expenses_bp.route('/api/expenses/delete/<int:expense_id>', methods=['DELETE'])
def delete_expense(expense_id):
    """Delete an expense"""
    try:
        user_id = session.get('user_id')
        if not user_id:
            return jsonify({'error': 'Unauthorized'}), 401
        
        conn = get_db()
        if not conn:
            return jsonify({'error': 'Database connection failed'}), 500
        
        cursor = conn.cursor()
        
        # Check if expense belongs to user
        cursor.execute("""
            SELECT id FROM expenses
            WHERE id = %s AND user_id = %s
        """, (expense_id, user_id))
        
        expense = cursor.fetchone()
        if not expense:
            cursor.close()
            conn.close()
            return jsonify({'error': 'Expense not found or unauthorized'}), 404
        
        # Delete expense
        cursor.execute("""
            DELETE FROM expenses
            WHERE id = %s AND user_id = %s
        """, (expense_id, user_id))
        
        conn.commit()
        cursor.close()
        conn.close()
        
        return jsonify({
            'message': 'Expense deleted successfully'
        }), 200
        
    except Exception as e:
        print(f"Error in delete_expense: {traceback.format_exc()}")
        return jsonify({'error': 'Internal server error', 'details': str(e)}), 500