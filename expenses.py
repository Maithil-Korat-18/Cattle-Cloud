from flask import Blueprint, request, jsonify, session, render_template
from datetime import datetime, timedelta
from decimal import Decimal
import traceback
from db import get_db

expenses_bp = Blueprint('expenses', __name__)


@expenses_bp.route('/expenses')
def expense():
    user_name = session.get('full_name')
    return render_template('expenses.html', user_name=user_name)


def decimal_to_float(obj):
    if isinstance(obj, Decimal):
        return float(obj)
    raise TypeError


# ════════════════════════════════════════════════════════════════
# GET FINANCIAL METRICS
# ════════════════════════════════════════════════════════════════
@expenses_bp.route('/api/expenses/metrics', methods=['GET'])
def get_financial_metrics():
    """Get total revenue, expenses, profit, and milk sold summary"""
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

        # Total revenue from milk sales
        cursor.execute("""
            SELECT 
                COALESCE(SUM(income), 0) as total_revenue,
                COALESCE(SUM(milk_liters), 0) as total_liters,
                COALESCE(SUM(income) / NULLIF(SUM(milk_liters), 0), 0) as avg_rate
            FROM milk_records
            WHERE user_id = %s AND date BETWEEN %s AND %s
        """, (user_id, from_date, to_date))
        revenue_data = cursor.fetchone()
        total_revenue = float(revenue_data['total_revenue']) if revenue_data else 0.0
        total_liters = float(revenue_data['total_liters']) if revenue_data else 0.0
        avg_rate = float(revenue_data['avg_rate']) if revenue_data else 0.0

        # Total expenses
        cursor.execute("""
            SELECT COALESCE(SUM(amount), 0) as total_expenses
            FROM expenses
            WHERE user_id = %s AND date BETWEEN %s AND %s
        """, (user_id, from_date, to_date))
        expense_data = cursor.fetchone()
        total_expenses = float(expense_data['total_expenses']) if expense_data else 0.0

        net_profit = total_revenue - total_expenses

        cursor.close()
        conn.close()

        return jsonify({
            'total_revenue': round(total_revenue, 2),
            'total_expenses': round(total_expenses, 2),
            'net_profit': round(net_profit, 2),
            # Milk sold summary: e.g. { liters: 320.5, avg_rate: 43.75 }
            'milk_sold': {
                'liters': round(total_liters, 2),
                'avg_rate': round(avg_rate, 2)
            },
            'date_range': {
                'from': from_date,
                'to': to_date
            }
        }), 200

    except Exception as e:
        print(f"Error in get_financial_metrics: {traceback.format_exc()}")
        return jsonify({'error': 'Internal server error', 'details': str(e)}), 500


# ════════════════════════════════════════════════════════════════
# GET CASH FLOW DATA
# ════════════════════════════════════════════════════════════════
@expenses_bp.route('/api/expenses/cashflow', methods=['GET'])
def get_cash_flow():
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

        cursor.execute("""
            SELECT date, COALESCE(SUM(income), 0) as revenue
            FROM milk_records
            WHERE user_id = %s AND date BETWEEN %s AND %s
            GROUP BY date
            ORDER BY date
        """, (user_id, from_date, to_date))
        revenue_records = cursor.fetchall()

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

        cash_flow_data = sorted(date_map.values(), key=lambda x: x['date'])

        return jsonify({
            'cash_flow': cash_flow_data,
            'date_range': {'from': from_date, 'to': to_date}
        }), 200

    except Exception as e:
        print(f"Error in get_cash_flow: {traceback.format_exc()}")
        return jsonify({'error': 'Internal server error', 'details': str(e)}), 500


# ════════════════════════════════════════════════════════════════
# GET MONEY BREAKDOWN BY CATEGORY (for pie/donut chart)
# ════════════════════════════════════════════════════════════════
@expenses_bp.route('/api/expenses/money-breakdown', methods=['GET'])
def get_money_breakdown():
    """
    Returns a combined breakdown:
      - Milk Sales (income)
      - Each expense category (Feed, Health, Veterinary, Labor, Equipment, etc.)
    """
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

        # Milk sales total (income side)
        cursor.execute("""
            SELECT COALESCE(SUM(income), 0) as total
            FROM milk_records
            WHERE user_id = %s AND date BETWEEN %s AND %s
        """, (user_id, from_date, to_date))
        milk_row = cursor.fetchone()
        milk_total = float(milk_row['total']) if milk_row else 0.0

        # Expense breakdown by category
        cursor.execute("""
            SELECT 
                COALESCE(category, 'Other') as category,
                COALESCE(SUM(amount), 0) as total
            FROM expenses
            WHERE user_id = %s AND date BETWEEN %s AND %s
            GROUP BY category
            ORDER BY total DESC
        """, (user_id, from_date, to_date))
        expense_rows = cursor.fetchall()

        cursor.close()
        conn.close()

        breakdown = []

        # Add milk sales as first item (income)
        if milk_total > 0:
            breakdown.append({
                'label': 'Milk Sales',
                'value': round(milk_total, 2),
                'kind': 'income'
            })

        # Add each expense category
        for row in expense_rows:
            val = float(row['total'])
            if val > 0:
                breakdown.append({
                    'label': row['category'],
                    'value': round(val, 2),
                    'kind': 'expense'
                })

        return jsonify({
            'breakdown': breakdown,
            'date_range': {'from': from_date, 'to': to_date}
        }), 200

    except Exception as e:
        print(f"Error in get_money_breakdown: {traceback.format_exc()}")
        return jsonify({'error': 'Internal server error', 'details': str(e)}), 500


# ════════════════════════════════════════════════════════════════
# GET TRANSACTIONS (pagination, filtering) — no status field
# ════════════════════════════════════════════════════════════════
@expenses_bp.route('/api/expenses/transactions', methods=['GET'])
def get_transactions():
    try:
        user_id = session.get('user_id')
        if not user_id:
            return jsonify({'error': 'Unauthorized'}), 401

        page = int(request.args.get('page', 1))
        per_page = int(request.args.get('per_page', 10))
        transaction_type = request.args.get('type', 'all')
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
        transactions = []

        if transaction_type in ['all', 'income']:
            cursor.execute("""
                SELECT 
                    m.id,
                    m.date,
                    CONCAT('Milk Sale — ', c.name) as description,
                    'Milk Sales' as category,
                    m.income as amount,
                    'income' as type
                FROM milk_records m
                JOIN cattle c ON m.cattle_id = c.id
                WHERE m.user_id = %s 
                AND m.date BETWEEN %s AND %s
                AND m.income > 0
            """, (user_id, from_date, to_date))
            transactions.extend(cursor.fetchall())

        if transaction_type in ['all', 'expense']:
            cursor.execute("""
                SELECT 
                    id,
                    date,
                    description,
                    category,
                    amount,
                    'expense' as type
                FROM expenses
                WHERE user_id = %s 
                AND date BETWEEN %s AND %s
            """, (user_id, from_date, to_date))
            transactions.extend(cursor.fetchall())

        cursor.close()
        conn.close()

        # Sort by date descending, handle None dates
        transactions.sort(
            key=lambda x: x['date'] if x['date'] else datetime.min.date(),
            reverse=True
        )

        total_transactions = len(transactions)
        start_idx = (page - 1) * per_page
        paginated = transactions[start_idx: start_idx + per_page]

        formatted = []
        for txn in paginated:
            formatted.append({
                'id': txn.get('id', 0),
                'date': txn['date'].strftime('%Y-%m-%d') if txn['date'] else '—',
                'description': txn['description'] or 'N/A',
                'category': txn['category'],
                'amount': float(txn['amount']),
                'type': txn['type'],
            })

        return jsonify({
            'transactions': formatted,
            'pagination': {
                'page': page,
                'per_page': per_page,
                'total': total_transactions,
                'total_pages': max(1, (total_transactions + per_page - 1) // per_page)
            },
            'date_range': {'from': from_date, 'to': to_date}
        }), 200

    except Exception as e:
        print(f"Error in get_transactions: {traceback.format_exc()}")
        return jsonify({'error': 'Internal server error', 'details': str(e)}), 500


# ════════════════════════════════════════════════════════════════
# ADD EXPENSE
# ════════════════════════════════════════════════════════════════
@expenses_bp.route('/api/expenses/add', methods=['POST'])
def add_expense():
    try:
        user_id = session.get('user_id')
        if not user_id:
            return jsonify({'error': 'Unauthorized'}), 401

        data = request.get_json()
        required_fields = ['date', 'category', 'description', 'amount']
        for field in required_fields:
            if field not in data or not data[field]:
                return jsonify({'error': f'Missing required field: {field}'}), 400

        try:
            amount = float(data['amount'])
            if amount <= 0:
                return jsonify({'error': 'Amount must be greater than 0'}), 400
        except ValueError:
            return jsonify({'error': 'Invalid amount'}), 400

        try:
            expense_date = datetime.strptime(data['date'], '%Y-%m-%d').date()
        except ValueError:
            return jsonify({'error': 'Invalid date format. Use YYYY-MM-DD'}), 400

        conn = get_db()
        if not conn:
            return jsonify({'error': 'Database connection failed'}), 500

        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO expenses (user_id, date, category, description, amount)
            VALUES (%s, %s, %s, %s, %s)
        """, (user_id, expense_date, data['category'], data['description'], amount))
        conn.commit()
        expense_id = cursor.lastrowid
        cursor.close()
        conn.close()

        return jsonify({'message': 'Expense added successfully', 'expense_id': expense_id}), 201

    except Exception as e:
        print(f"Error in add_expense: {traceback.format_exc()}")
        return jsonify({'error': 'Internal server error', 'details': str(e)}), 500


# ════════════════════════════════════════════════════════════════
# DELETE EXPENSE
# ════════════════════════════════════════════════════════════════
@expenses_bp.route('/api/expenses/delete/<int:expense_id>', methods=['DELETE'])
def delete_expense(expense_id):
    try:
        user_id = session.get('user_id')
        if not user_id:
            return jsonify({'error': 'Unauthorized'}), 401

        conn = get_db()
        if not conn:
            return jsonify({'error': 'Database connection failed'}), 500

        cursor = conn.cursor()
        cursor.execute("""
            SELECT id FROM expenses WHERE id = %s AND user_id = %s
        """, (expense_id, user_id))

        if not cursor.fetchone():
            cursor.close()
            conn.close()
            return jsonify({'error': 'Expense not found or unauthorized'}), 404

        cursor.execute("""
            DELETE FROM expenses WHERE id = %s AND user_id = %s
        """, (expense_id, user_id))
        conn.commit()
        cursor.close()
        conn.close()

        return jsonify({'message': 'Expense deleted successfully'}), 200

    except Exception as e:
        print(f"Error in delete_expense: {traceback.format_exc()}")
        return jsonify({'error': 'Internal server error', 'details': str(e)}), 500


# ════════════════════════════════════════════════════════════════
# GENERATE PDF REPORT DATA
# ════════════════════════════════════════════════════════════════
@expenses_bp.route('/api/expenses/report-data', methods=['GET'])
def get_report_data():
    try:
        user_id = session.get('user_id')
        if not user_id:
            return jsonify({'error': 'Unauthorized'}), 401

        from_date = request.args.get('from_date')
        to_date = request.args.get('to_date')
        report_type = request.args.get('type', 'all')

        if not from_date or not to_date:
            return jsonify({'error': 'Date range required'}), 400

        conn = get_db()
        if not conn:
            return jsonify({'error': 'Database connection failed'}), 500

        cursor = conn.cursor(dictionary=True)
        transactions = []

        if report_type in ['all', 'income']:
            cursor.execute("""
                SELECT 
                    m.date,
                    CONCAT('Milk Sale — ', c.name) as description,
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
            transactions.extend(cursor.fetchall())

        if report_type in ['all', 'expense']:
            cursor.execute("""
                SELECT date, description, category, amount, 'expense' as type
                FROM expenses
                WHERE user_id = %s AND date BETWEEN %s AND %s
                ORDER BY date DESC
            """, (user_id, from_date, to_date))
            transactions.extend(cursor.fetchall())

        cursor.close()
        conn.close()

        total_income = sum(float(t['amount']) for t in transactions if t['type'] == 'income')
        total_expense = sum(float(t['amount']) for t in transactions if t['type'] == 'expense')
        net_profit = total_income - total_expense

        formatted = []
        for txn in sorted(transactions, key=lambda x: x['date'] if x['date'] else datetime.min.date(), reverse=True):
            formatted.append({
                'date': txn['date'].strftime('%Y-%m-%d') if txn['date'] else '—',
                'description': txn['description'] or 'N/A',
                'category': txn['category'],
                'amount': float(txn['amount']),
                'type': txn['type']
            })

        return jsonify({
            'transactions': formatted,
            'summary': {
                'total_income': round(total_income, 2),
                'total_expense': round(total_expense, 2),
                'net_profit': round(net_profit, 2),
                'transaction_count': len(formatted)
            },
            'date_range': {'from': from_date, 'to': to_date},
            'report_type': report_type
        }), 200

    except Exception as e:
        print(f"Error in get_report_data: {traceback.format_exc()}")
        return jsonify({'error': 'Internal server error', 'details': str(e)}), 500