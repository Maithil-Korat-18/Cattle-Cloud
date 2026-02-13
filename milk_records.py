from flask import Blueprint, render_template, request, jsonify, session, redirect, url_for, send_file
from functools import wraps
from datetime import datetime, timedelta
from db import get_db
import csv
import io
from reportlab.lib import colors
from reportlab.lib.pagesizes import letter, A4
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch

milk_bp = Blueprint('milk', __name__)

@milk_bp.route('/milk')
def milk_records():
    user_id = session.get('user_id')
    user_name = session.get('full_name', 'User')
    return render_template('milk_records.html', user_name=user_name)

@milk_bp.route('/milk/summary')
def get_summary():
    user_id = session.get('user_id')
    connection = get_db()
    cursor = connection.cursor(dictionary=True)
    
    try:
        today = datetime.now().date()
        yesterday = today - timedelta(days=1)
        
        # Today's total yield
        cursor.execute("""
            SELECT COALESCE(SUM(milk_liters), 0) as total_yield,
                   COALESCE(SUM(morning_liters), 0) as morning_total,
                   COALESCE(SUM(evening_liters), 0) as evening_total
            FROM milk_records
            WHERE user_id = %s AND date = %s
        """, (user_id, today))
        today_data = cursor.fetchone()
        
        # Yesterday's total for comparison
        cursor.execute("""
            SELECT COALESCE(SUM(milk_liters), 0) as total_yield
            FROM milk_records
            WHERE user_id = %s AND date = %s
        """, (user_id, yesterday))
        yesterday_data = cursor.fetchone()
        
        # Calculate percentage change
        if yesterday_data['total_yield'] > 0:
            change = ((today_data['total_yield'] - yesterday_data['total_yield']) / yesterday_data['total_yield']) * 100
        else:
            change = 0
        
        # Average per cow
        cursor.execute("""
            SELECT COUNT(DISTINCT cattle_id) as cattle_count
            FROM milk_records
            WHERE user_id = %s AND date = %s
        """, (user_id, today))
        cattle_count_data = cursor.fetchone()
        cattle_count = cattle_count_data['cattle_count'] if cattle_count_data else 0
        
        avg_per_cow = today_data['total_yield'] / cattle_count if cattle_count > 0 else 0
        
        cursor.close()
        connection.close()
        
        return jsonify({
            'success': True,
            'today_total': float(today_data['total_yield']),
            'morning_total': float(today_data['morning_total']),
            'evening_total': float(today_data['evening_total']),
            'change_percent': round(change, 1),
            'avg_per_cow': round(avg_per_cow, 1),
            'cattle_count': cattle_count
        })
    
    except Exception as e:
        cursor.close()
        connection.close()
        return jsonify({'success': False, 'error': str(e)}), 500

@milk_bp.route('/milk/data')
def get_milk_data():
    user_id = session.get('user_id')
    page = request.args.get('page', 1, type=int)
    per_page = request.args.get('per_page', 10, type=int)
    search = request.args.get('search', '')
    start_date = request.args.get('start_date')
    end_date = request.args.get('end_date')
    
    connection = get_db()
    cursor = connection.cursor(dictionary=True)
    
    try:
        # Build query
        query = """
            SELECT mr.*, c.tag_no, c.name, c.breed
            FROM milk_records mr
            LEFT JOIN cattle c ON mr.cattle_id = c.id
            WHERE mr.user_id = %s
        """
        params = [user_id]
        
        # Search filter
        if search:
            query += " AND (c.tag_no LIKE %s OR c.name LIKE %s)"
            search_param = f"%{search}%"
            params.extend([search_param, search_param])
        
        # Date range filter
        if start_date and end_date:
            query += " AND mr.date BETWEEN %s AND %s"
            params.extend([start_date, end_date])
        
        # Get total count
        count_query = query.replace("SELECT mr.*, c.tag_no, c.name, c.breed", "SELECT COUNT(*) as total")
        cursor.execute(count_query, params)
        total = cursor.fetchone()['total']
        
        # Get paginated data
        query += " ORDER BY mr.date DESC, mr.created_at DESC LIMIT %s OFFSET %s"
        params.extend([per_page, (page - 1) * per_page])
        
        cursor.execute(query, params)
        records = cursor.fetchall()
        
        # Convert date objects to strings
        for record in records:
            if isinstance(record['date'], datetime):
                record['date'] = record['date'].strftime('%Y-%m-%d')
            if record.get('created_at') and isinstance(record['created_at'], datetime):
                record['created_at'] = record['created_at'].strftime('%Y-%m-%d %H:%M:%S')
        
        cursor.close()
        connection.close()
        
        return jsonify({
            'success': True,
            'records': records,
            'total': total,
            'page': page,
            'per_page': per_page,
            'total_pages': (total + per_page - 1) // per_page
        })
    
    except Exception as e:
        cursor.close()
        connection.close()
        return jsonify({'success': False, 'error': str(e)}), 500

@milk_bp.route('/milk/add', methods=['POST'])
def add_milk_record():
    user_id = session.get('user_id')
    
    try:
        data = request.get_json()
        
        cattle_id = data.get('cattle_id')
        date = data.get('date')
        morning_liters = float(data.get('morning_liters', 0))
        evening_liters = float(data.get('evening_liters', 0))
        rate = float(data.get('rate', 0))
        
        milk_liters = morning_liters + evening_liters
        income = milk_liters * rate
        
        connection = get_db()
        cursor = connection.cursor()
        
        cursor.execute("""
            INSERT INTO milk_records 
            (user_id, cattle_id, date, morning_liters, evening_liters, rate, income)
            VALUES (%s, %s, %s, %s, %s, %s, %s)
        """, (user_id, cattle_id, date, morning_liters, evening_liters, rate, income))
        
        connection.commit()
        cursor.close()
        connection.close()
        
        return jsonify({'success': True, 'message': 'Milk record added successfully'})
    
    except Exception as e:
        if 'connection' in locals():
            connection.rollback()
            cursor.close()
            connection.close()
        return jsonify({'success': False, 'error': str(e)}), 500

@milk_bp.route('/milk/update/<int:id>', methods=['POST'])
def update_milk_record(id):
    user_id = session.get('user_id')
    
    try:
        data = request.get_json()
        
        morning_liters = float(data.get('morning_liters', 0))
        evening_liters = float(data.get('evening_liters', 0))
        rate = float(data.get('rate', 0))
        date = data.get('date')
        
        milk_liters = morning_liters + evening_liters
        income = milk_liters * rate
        
        connection = get_db()
        cursor = connection.cursor()
        
        cursor.execute("""
            UPDATE milk_records 
            SET morning_liters = %s, evening_liters = %s, rate = %s, 
                date = %s, income = %s
            WHERE id = %s AND user_id = %s
        """, (morning_liters, evening_liters, rate, date, income, id, user_id))
        
        connection.commit()
        cursor.close()
        connection.close()
        
        return jsonify({'success': True, 'message': 'Record updated successfully'})
    
    except Exception as e:
        if 'connection' in locals():
            connection.rollback()
            cursor.close()
            connection.close()
        return jsonify({'success': False, 'error': str(e)}), 500

@milk_bp.route('/milk/delete/<int:id>', methods=['DELETE'])
def delete_milk_record(id):
    user_id = session.get('user_id')
    
    try:
        connection = get_db()
        cursor = connection.cursor()
        
        cursor.execute("""
            DELETE FROM milk_records 
            WHERE id = %s AND user_id = %s
        """, (id, user_id))
        
        connection.commit()
        cursor.close()
        connection.close()
        
        return jsonify({'success': True, 'message': 'Record deleted successfully'})
    
    except Exception as e:
        if 'connection' in locals():
            connection.rollback()
            cursor.close()
            connection.close()
        return jsonify({'success': False, 'error': str(e)}), 500

@milk_bp.route('/milk/cattle-list')
def get_cattle_list():
    user_id = session.get('user_id')
    
    connection = get_db()
    cursor = connection.cursor(dictionary=True)
    
    try:
        cursor.execute("""
            SELECT id, tag_no, name, breed
            FROM cattle
            WHERE user_id = %s
            ORDER BY name
        """, (user_id,))
        
        cattle = cursor.fetchall()
        
        cursor.close()
        connection.close()
        
        return jsonify({'success': True, 'cattle': cattle})
    
    except Exception as e:
        cursor.close()
        connection.close()
        return jsonify({'success': False, 'error': str(e)}), 500

@milk_bp.route('/milk/report', methods=['POST'])
def generate_report():
    user_id = session.get('user_id')
    
    try:
        data = request.get_json()
        
        start_date = data.get('start_date')
        end_date = data.get('end_date')
        cattle_id = data.get('cattle_id')
        report_type = data.get('report_type', 'daily')
        format_type = data.get('format', 'pdf')
        
        connection = get_db()
        cursor = connection.cursor(dictionary=True)
        
        # Build query
        query = """
            SELECT mr.date, c.tag_no, c.name, c.breed,
                   mr.morning_liters, mr.evening_liters, 
                   mr.milk_liters, mr.rate, mr.income
            FROM milk_records mr
            LEFT JOIN cattle c ON mr.cattle_id = c.id
            WHERE mr.user_id = %s
        """
        params = [user_id]
        
        if start_date and end_date:
            query += " AND mr.date BETWEEN %s AND %s"
            params.extend([start_date, end_date])
        
        if cattle_id and cattle_id != 'all':
            query += " AND mr.cattle_id = %s"
            params.append(cattle_id)
        
        query += " ORDER BY mr.date DESC"
        
        cursor.execute(query, params)
        records = cursor.fetchall()
        
        # Convert dates
        for record in records:
            if isinstance(record['date'], datetime):
                record['date'] = record['date'].strftime('%Y-%m-%d')
        
        cursor.close()
        connection.close()
        
        if format_type == 'csv':
            return generate_csv_report(records, start_date, end_date)
        else:
            return generate_pdf_report(records, start_date, end_date)
    
    except Exception as e:
        if 'cursor' in locals():
            cursor.close()
            connection.close()
        return jsonify({'success': False, 'error': str(e)}), 500

def generate_csv_report(records, start_date, end_date):
    output = io.StringIO()
    writer = csv.writer(output)
    
    # Write header
    writer.writerow(['Milk Production Report'])
    writer.writerow([f'Period: {start_date} to {end_date}'])
    writer.writerow([])
    writer.writerow(['Date', 'Cattle Tag', 'Cattle Name', 'Breed', 'Morning (L)', 'Evening (L)', 'Total (L)', 'Rate (₹)', 'Income (₹)'])
    
    # Write data
    total_milk = 0
    total_income = 0
    
    for record in records:
        writer.writerow([
            record['date'],
            record['tag_no'] or 'N/A',
            record['name'] or 'N/A',
            record['breed'] or 'N/A',
            round(float(record['morning_liters']), 2),
            round(float(record['evening_liters']), 2),
            round(float(record['milk_liters']), 2),
            round(float(record['rate']), 2),
            round(float(record['income']), 2)
        ])
        total_milk += float(record['milk_liters'])
        total_income += float(record['income'])
    
    # Write summary
    writer.writerow([])
    writer.writerow(['Summary'])
    writer.writerow(['Total Records', len(records)])
    writer.writerow(['Total Milk Production (L)', round(total_milk, 2)])
    writer.writerow(['Total Income (₹)', round(total_income, 2)])
    writer.writerow(['Average per Record (L)', round(total_milk / len(records), 2) if len(records) > 0 else 0])
    
    output.seek(0)
    
    return send_file(
        io.BytesIO(output.getvalue().encode('utf-8')),
        mimetype='text/csv',
        as_attachment=True,
        download_name=f'milk_report_{start_date}_to_{end_date}.csv'
    )

def generate_pdf_report(records, start_date, end_date):
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=A4, rightMargin=30, leftMargin=30, topMargin=30, bottomMargin=30)
    elements = []
    
    styles = getSampleStyleSheet()
    title_style = ParagraphStyle(
        'CustomTitle',
        parent=styles['Heading1'],
        fontSize=18,
        textColor=colors.HexColor('#667fea'),
        spaceAfter=20,
        alignment=1,
        fontName='Helvetica-Bold'
    )
    
    subtitle_style = ParagraphStyle(
        'CustomSubtitle',
        parent=styles['Normal'],
        fontSize=12,
        textColor=colors.HexColor('#6b7280'),
        spaceAfter=30,
        alignment=1
    )
    
    # Title
    title = Paragraph('Milk Production Report', title_style)
    elements.append(title)
    
    # Period
    period_text = f'Period: {start_date} to {end_date}'
    elements.append(Paragraph(period_text, subtitle_style))
    
    # Table data
    table_data = [['Date', 'Tag', 'Name', 'Morning', 'Evening', 'Total', 'Rate', 'Income']]
    
    total_milk = 0
    total_income = 0
    
    for record in records:
        table_data.append([
            record['date'],
            record['tag_no'] or 'N/A',
            (record['name'] or 'N/A')[:15],  # Truncate long names
            f"{float(record['morning_liters']):.1f}",
            f"{float(record['evening_liters']):.1f}",
            f"{float(record['milk_liters']):.1f}",
            f"₹{float(record['rate']):.2f}",
            f"₹{float(record['income']):.2f}"
        ])
        total_milk += float(record['milk_liters'])
        total_income += float(record['income'])
    
    # Create table
    col_widths = [70, 50, 80, 50, 50, 45, 55, 65]
    table = Table(table_data, colWidths=col_widths, repeatRows=1)
    table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#667fea')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, 0), 9),
        ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
        ('TOPPADDING', (0, 0), (-1, 0), 12),
        ('BACKGROUND', (0, 1), (-1, -1), colors.white),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
        ('FONTSIZE', (0, 1), (-1, -1), 8),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#f9fafb')]),
        ('TOPPADDING', (0, 1), (-1, -1), 8),
        ('BOTTOMPADDING', (0, 1), (-1, -1), 8),
    ]))
    
    elements.append(table)
    elements.append(Spacer(1, 0.4 * inch))
    
    # Summary
    if len(records) > 0:
        summary_style = ParagraphStyle(
            'Summary',
            parent=styles['Normal'],
            fontSize=11,
            spaceAfter=6
        )
        
        elements.append(Paragraph('<b>Summary</b>', summary_style))
        elements.append(Paragraph(f'Total Records: {len(records)}', summary_style))
        elements.append(Paragraph(f'Total Milk Production: {total_milk:.2f} L', summary_style))
        elements.append(Paragraph(f'Total Income: ₹{total_income:.2f}', summary_style))
        elements.append(Paragraph(f'Average per Record: {total_milk / len(records):.2f} L', summary_style))
    else:
        elements.append(Paragraph('No records found for the selected period', styles['Normal']))
    
    # Build PDF
    doc.build(elements)
    buffer.seek(0)
    
    # Return with proper headers
    return send_file(
        buffer,
        mimetype='application/pdf',
        as_attachment=True,
        download_name=f'milk_report_{start_date}_to_{end_date}.pdf'
    )
