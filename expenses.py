from flask import Blueprint, render_template, request, jsonify, session, send_file, redirect, url_for
from db import get_db
from datetime import datetime, timedelta
import csv
import io

expenses_bp = Blueprint('expenses', __name__, url_prefix='/expenses')

@expenses_bp.route('/')
def index():
    if 'user_id' not in session:
        return redirect(url_for('auth.login'))
    return render_template('expenses.html')

@expenses_bp.route('/metrics')
def get_metrics():
    user_id = session.get('user_id')
    if not user_id:
        return jsonify({'error': 'Unauthorized'}), 401
    
    try:
        db = get_db()
        cursor = db.cursor(dictionary=True)
        
        cursor.execute("""
            SELECT COALESCE(SUM(income), 0) as total_revenue
            FROM milk_records
            WHERE user_id = %s
        """, (user_id,))
        revenue_result = cursor.fetchone()
        total_revenue = float(revenue_result['total_revenue'])
        
        cursor.execute("""
            SELECT COALESCE(SUM(amount), 0) as total_expenses
            FROM expenses
            WHERE user_id = %s
        """, (user_id,))
        expenses_result = cursor.fetchone()
        total_expenses = float(expenses_result['total_expenses'])
        
        net_profit = total_revenue - total_expenses
        
        cursor.execute("""
            SELECT COUNT(*) as pending_count
            FROM expenses
            WHERE user_id = %s AND LOWER(description) LIKE %s
        """, (user_id, '%pending%'))
        pending_result = cursor.fetchone()
        pending_count = pending_result['pending_count']
        
        cursor.close()
        
        return jsonify({
            'revenue': total_revenue,
            'total_expenses': total_expenses,
            'net_profit': net_profit,
            'pending_count': pending_count
        })
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@expenses_bp.route('/cashflow')
def get_cashflow():
    user_id = session.get('user_id')
    if not user_id:
        return jsonify({'error': 'Unauthorized'}), 401
    
    try:
        db = get_db()
        cursor = db.cursor(dictionary=True)
        
        six_months_ago = datetime.now() - timedelta(days=180)
        
        cursor.execute("""
            SELECT 
                DATE_FORMAT(date, '%%Y-%%m') as month,
                COALESCE(SUM(income), 0) as revenue
            FROM milk_records
            WHERE user_id = %s AND date >= %s
            GROUP BY DATE_FORMAT(date, '%%Y-%%m')
            ORDER BY month
        """, (user_id, six_months_ago))
        revenue_data = cursor.fetchall()
        
        cursor.execute("""
            SELECT 
                DATE_FORMAT(date, '%%Y-%%m') as month,
                COALESCE(SUM(amount), 0) as expenses
            FROM expenses
            WHERE user_id = %s AND date >= %s
            GROUP BY DATE_FORMAT(date, '%%Y-%%m')
            ORDER BY month
        """, (user_id, six_months_ago))
        expenses_data = cursor.fetchall()
        
        cursor.close()
        
        months = []
        current = datetime.now()
        for i in range(5, -1, -1):
            month = (current - timedelta(days=30*i)).strftime('%Y-%m')
            months.append(month)
        
        revenue_map = {item['month']: float(item['revenue']) for item in revenue_data}
        expenses_map = {item['month']: float(item['expenses']) for item in expenses_data}
        
        result = []
        for month in months:
            result.append({
                'month': month,
                'revenue': revenue_map.get(month, 0),
                'expenses': expenses_map.get(month, 0)
            })
        
        return jsonify(result)
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@expenses_bp.route('/transactions')
def get_transactions():
    user_id = session.get('user_id')
    if not user_id:
        return jsonify({'error': 'Unauthorized'}), 401
    
    try:
        db = get_db()
        cursor = db.cursor(dictionary=True)
        
        cursor.execute("""
            SELECT 
                date,
                description,
                category,
                -amount as amount,
                'expense' as type,
                CASE 
                    WHEN LOWER(description) LIKE '%%pending%%' THEN 'Pending'
                    ELSE 'Paid'
                END as status
            FROM expenses
            WHERE user_id = %s
        """, (user_id,))
        expenses = cursor.fetchall()
        
        cursor.execute("""
            SELECT 
                date,
                CONCAT('Milk Sale - ', milk_liters, 'L @ ₹', rate) as description,
                'Milk Sales' as category,
                income as amount,
                'income' as type,
                'Paid' as status
            FROM milk_records
            WHERE user_id = %s
        """, (user_id,))
        income = cursor.fetchall()
        
        cursor.close()
        
        all_transactions = expenses + income
        all_transactions.sort(key=lambda x: x['date'], reverse=True)
        
        result = []
        for txn in all_transactions[:10]:
            result.append({
                'date': txn['date'].strftime('%Y-%m-%d'),
                'description': txn['description'],
                'category': txn['category'],
                'amount': float(txn['amount']),
                'type': txn['type'],
                'status': txn['status']
            })
        
        return jsonify(result)
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@expenses_bp.route('/add', methods=['POST'])
def add_expense():
    user_id = session.get('user_id')
    if not user_id:
        return jsonify({'error': 'Unauthorized'}), 401
    
    try:
        data = request.get_json()
        date = data.get('date')
        category = data.get('category')
        description = data.get('description')
        amount = data.get('amount')
        
        if not all([date, category, description, amount]):
            return jsonify({'error': 'All fields are required'}), 400
        
        db = get_db()
        cursor = db.cursor()
        
        cursor.execute("""
            INSERT INTO expenses (user_id, date, category, description, amount, created_at)
            VALUES (%s, %s, %s, %s, %s, NOW())
        """, (user_id, date, category, description, amount))
        
        db.commit()
        cursor.close()
        
        return jsonify({'success': True, 'message': 'Expense added successfully'})
        
    except Exception as e:
        db.rollback()
        return jsonify({'error': str(e)}), 500

@expenses_bp.route('/report')
def generate_report():
    user_id = session.get('user_id')
    if not user_id:
        return jsonify({'error': 'Unauthorized'}), 401
    
    try:
        db = get_db()
        cursor = db.cursor(dictionary=True)
        
        cursor.execute("""
            SELECT date, 'Expense' as type, category, description, amount
            FROM expenses
            WHERE user_id = %s
            ORDER BY date DESC
        """, (user_id,))
        expenses = cursor.fetchall()
        
        cursor.execute("""
            SELECT 
                date,
                'Income' as type,
                'Milk Sales' as category,
                CONCAT('Milk Sale - ', milk_liters, 'L @ ₹', rate) as description,
                income as amount
            FROM milk_records
            WHERE user_id = %s
            ORDER BY date DESC
        """, (user_id,))
        income = cursor.fetchall()
        
        cursor.close()
        
        all_records = expenses + income
        all_records.sort(key=lambda x: x['date'], reverse=True)
        
        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow(['Date', 'Type', 'Category', 'Description', 'Amount'])
        
        for record in all_records:
            writer.writerow([
                record['date'].strftime('%Y-%m-%d'),
                record['type'],
                record['category'],
                record['description'],
                float(record['amount'])
            ])
        
        output.seek(0)
        bytes_output = io.BytesIO()
        bytes_output.write(output.getvalue().encode('utf-8'))
        bytes_output.seek(0)
        
        return send_file(
            bytes_output,
            mimetype='text/csv',
            as_attachment=True,
            download_name=f'financial_report_{datetime.now().strftime("%Y%m%d")}.csv'
        )
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@expenses_bp.route('/revenue-breakdown')
def get_revenue_breakdown():
    user_id = session.get('user_id')
    if not user_id:
        return jsonify({'error': 'Unauthorized'}), 401
    
    try:
        db = get_db()
        cursor = db.cursor(dictionary=True)
        
        cursor.execute("""
            SELECT COALESCE(SUM(income), 0) as milk_sales
            FROM milk_records
            WHERE user_id = %s
        """, (user_id,))
        milk_result = cursor.fetchone()
        milk_sales = float(milk_result['milk_sales'])
        
        cattle_sales = 0
        
        cursor.execute("""
            SELECT category, COALESCE(SUM(amount), 0) as total
            FROM expenses
            WHERE user_id = %s
            GROUP BY category
        """, (user_id,))
        categories = cursor.fetchall()
        
        cursor.close()
        
        return jsonify({
            'milk_sales': milk_sales,
            'cattle_sales': cattle_sales,
            'categories': [{'name': c['category'], 'value': float(c['total'])} for c in categories]
        })
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500
