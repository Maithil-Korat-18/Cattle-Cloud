from flask import Blueprint, render_template, request, jsonify, session, redirect, url_for, send_file
from datetime import datetime, timedelta
from db import get_db
from reportlab.lib.pagesizes import letter, A4
from reportlab.lib import colors
from reportlab.lib.units import inch
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer, PageBreak, Image
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT
from reportlab.pdfgen import canvas
import io

cattle_detail_bp = Blueprint('cattle_detail', __name__)


@cattle_detail_bp.route('/cattle/<int:id>')
def cattle_detail(id):
    user_id = session.get('user_id')
    if not user_id:
        return redirect(url_for('auth.login'))
    
    connection = get_db()
    if not connection:
        return "Database connection error", 500
    
    cursor = connection.cursor(dictionary=True)
    
    try:
        # Get cattle details
        cursor.execute("""
            SELECT * FROM cattle 
            WHERE id = %s AND user_id = %s
        """, (id, user_id))
        cattle = cursor.fetchone()
        
        if not cattle:
            cursor.close()
            connection.close()
            return "Cattle not found", 404
        
        # Get last 7 days milk production for chart
        cursor.execute("""
            SELECT date, milk_liters, income
            FROM milk_records
            WHERE cattle_id = %s AND user_id = %s
            AND date >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)
            ORDER BY date ASC
        """, (id, user_id))
        milk_chart_data = cursor.fetchall()
        
        # Calculate total milk and income
        cursor.execute("""
            SELECT 
                COALESCE(SUM(milk_liters), 0) as total_milk,
                COALESCE(SUM(income), 0) as total_income,
                COUNT(*) as total_records
            FROM milk_records
            WHERE cattle_id = %s AND user_id = %s
        """, (id, user_id))
        milk_stats = cursor.fetchone()
        
        # Get average daily yield (last 7 days)
        cursor.execute("""
            SELECT COALESCE(AVG(milk_liters), 0) as avg_yield
            FROM milk_records
            WHERE cattle_id = %s AND user_id = %s
            AND date >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)
        """, (id, user_id))
        avg_yield = cursor.fetchone()['avg_yield']
        
        # Get recent milk records (last 10)
        cursor.execute("""
            SELECT * FROM milk_records
            WHERE cattle_id = %s AND user_id = %s
            ORDER BY date DESC
            LIMIT 10
        """, (id, user_id))
        milk_records = cursor.fetchall()
        
        # Get recent health records
        cursor.execute("""
            SELECT * FROM health_records
            WHERE cattle_id = %s AND user_id = %s
            ORDER BY created_at DESC
            LIMIT 10
        """, (id, user_id))
        health_records = cursor.fetchall()
        
        cursor.close()
        connection.close()
        
        # Convert dates to strings for JSON serialization
        for record in milk_chart_data:
            if isinstance(record['date'], datetime):
                record['date'] = record['date'].strftime('%Y-%m-%d')
        
        return render_template('cattle_detail.html',
                             cattle=cattle,
                             milk_chart_data=milk_chart_data,
                             milk_stats=milk_stats,
                             avg_yield=round(float(avg_yield), 1),
                             milk_records=milk_records,
                             health_records=health_records,
                             user_name=session.get('full_name', 'User'))
    
    except Exception as e:
        if cursor:
            cursor.close()
        if connection:
            connection.close()
        return f"Error: {str(e)}", 500


@cattle_detail_bp.route('/cattle/<int:id>/milk')
def get_milk_records(id):
    user_id = session.get('user_id')
    page = request.args.get('page', 1, type=int)
    per_page = request.args.get('per_page', 10, type=int)
    
    connection = get_db()
    cursor = connection.cursor(dictionary=True)
    
    try:
        # Get total count
        cursor.execute("""
            SELECT COUNT(*) as total FROM milk_records
            WHERE cattle_id = %s AND user_id = %s
        """, (id, user_id))
        total = cursor.fetchone()['total']
        
        # Get paginated records
        cursor.execute("""
            SELECT * FROM milk_records
            WHERE cattle_id = %s AND user_id = %s
            ORDER BY date DESC
            LIMIT %s OFFSET %s
        """, (id, user_id, per_page, (page - 1) * per_page))
        records = cursor.fetchall()
        
        # Convert date objects to strings
        for record in records:
            if isinstance(record['date'], datetime):
                record['date'] = record['date'].strftime('%Y-%m-%d')
        
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


@cattle_detail_bp.route('/cattle/<int:id>/milk-chart')
def get_milk_chart_data(id):
    user_id = session.get('user_id')
    days = request.args.get('days', type=int)
    start_date = request.args.get('start_date')
    end_date = request.args.get('end_date')
    
    connection = get_db()
    cursor = connection.cursor(dictionary=True)
    
    try:
        query = """
            SELECT date, milk_liters, income
            FROM milk_records
            WHERE cattle_id = %s AND user_id = %s
        """
        params = [id, user_id]
        
        if start_date and end_date:
            query += " AND date BETWEEN %s AND %s"
            params.extend([start_date, end_date])
        elif days:
            query += " AND date >= DATE_SUB(CURDATE(), INTERVAL %s DAY)"
            params.append(days)
        else:
            # Default to last 7 days if no parameters provided
            query += " AND date >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)"
        
        query += " ORDER BY date ASC"
        
        cursor.execute(query, params)
        data = cursor.fetchall()
        
        # Convert date objects to strings
        for record in data:
            if isinstance(record['date'], datetime):
                record['date'] = record['date'].strftime('%Y-%m-%d')
        
        cursor.close()
        connection.close()
        
        return jsonify({
            'success': True,
            'data': data
        })
    
    except Exception as e:
        cursor.close()
        connection.close()
        return jsonify({'success': False, 'error': str(e)}), 500


@cattle_detail_bp.route('/cattle/<int:id>/add-milk', methods=['POST'])
def add_milk_record(id):
    user_id = session.get('user_id')
    
    try:
        data = request.get_json()
        
        date = data.get('date')
        morning_liters = float(data.get('morning_liters', 0))
        evening_liters = float(data.get('evening_liters', 0))
        rate = float(data.get('rate', 0))
        
        milk_liters = morning_liters + evening_liters
        income = milk_liters * rate
        
        connection = get_db()
        cursor = connection.cursor()
        
        # Verify cattle belongs to user
        cursor.execute("""
            SELECT id FROM cattle WHERE id = %s AND user_id = %s
        """, (id, user_id))
        
        if not cursor.fetchone():
            cursor.close()
            connection.close()
            return jsonify({'success': False, 'error': 'Cattle not found'}), 404
        
        # Insert milk record
        cursor.execute("""
            INSERT INTO milk_records 
            (user_id, cattle_id, date, morning_liters, evening_liters, rate, income)
            VALUES (%s, %s, %s, %s, %s, %s, %s)
        """, (user_id, id, date, morning_liters, evening_liters, rate, income))
        
        connection.commit()
        cursor.close()
        connection.close()
        
        return jsonify({
            'success': True,
            'message': 'Milk record added successfully'
        })
    
    except Exception as e:
        if 'connection' in locals() and connection:
            connection.rollback()
            cursor.close()
            connection.close()
        return jsonify({'success': False, 'error': str(e)}), 500


@cattle_detail_bp.route('/cattle/<int:id>/add-health', methods=['POST'])
def add_health_record(id):
    user_id = session.get('user_id')
    
    try:
        data = request.get_json()
        
        issue = data.get('issue')
        treatment = data.get('treatment')
        vet_name = data.get('vet_name')
        next_checkup = data.get('next_checkup')
        
        connection = get_db()
        cursor = connection.cursor()
        
        # Verify cattle belongs to user
        cursor.execute("""
            SELECT id FROM cattle WHERE id = %s AND user_id = %s
        """, (id, user_id))
        
        if not cursor.fetchone():
            cursor.close()
            connection.close()
            return jsonify({'success': False, 'error': 'Cattle not found'}), 404
        
        # Insert health record
        cursor.execute("""
            INSERT INTO health_records 
            (user_id, cattle_id, issue, treatment, vet_name, next_checkup)
            VALUES (%s, %s, %s, %s, %s, %s)
        """, (user_id, id, issue, treatment, vet_name, next_checkup))
        
        connection.commit()
        cursor.close()
        connection.close()
        
        return jsonify({
            'success': True,
            'message': 'Health record added successfully'
        })
    
    except Exception as e:
        if 'connection' in locals() and connection:
            connection.rollback()
            cursor.close()
            connection.close()
        return jsonify({'success': False, 'error': str(e)}), 500


@cattle_detail_bp.route('/cattle/<int:id>/update', methods=['POST'])
def update_cattle(id):
    user_id = session.get('user_id')
    
    try:
        data = request.get_json()
        
        name = data.get('name')
        tag_no = data.get('tag_no')
        breed = data.get('breed')
        age = data.get('age')
        gender = data.get('gender')
        health = data.get('health')
        
        connection = get_db()
        cursor = connection.cursor()
        
        # Verify cattle belongs to user
        cursor.execute("""
            SELECT id FROM cattle WHERE id = %s AND user_id = %s
        """, (id, user_id))
        
        if not cursor.fetchone():
            cursor.close()
            connection.close()
            return jsonify({'success': False, 'error': 'Cattle not found'}), 404
        
        # Update cattle
        cursor.execute("""
            UPDATE cattle 
            SET name = %s, tag_no = %s, breed = %s, age = %s, 
                gender = %s, health = %s
            WHERE id = %s AND user_id = %s
        """, (name, tag_no, breed, age, gender, health, id, user_id))
        
        connection.commit()
        cursor.close()
        connection.close()
        
        return jsonify({
            'success': True,
            'message': 'Cattle updated successfully'
        })
    
    except Exception as e:
        if 'connection' in locals() and connection:
            connection.rollback()
            cursor.close()
            connection.close()
        return jsonify({'success': False, 'error': str(e)}), 500


@cattle_detail_bp.route('/cattle/<int:id>/generate-pdf')
def generate_pdf(id):
    user_id = session.get('user_id')
    start_date = request.args.get('start_date')
    end_date = request.args.get('end_date')
    
    connection = get_db()
    cursor = connection.cursor(dictionary=True)
    
    try:
        # Get cattle details
        cursor.execute("""
            SELECT * FROM cattle WHERE id = %s AND user_id = %s
        """, (id, user_id))
        cattle = cursor.fetchone()
        
        if not cattle:
            return "Cattle not found", 404
        
        # Get milk records in date range
        cursor.execute("""
            SELECT * FROM milk_records
            WHERE cattle_id = %s AND user_id = %s
            AND date BETWEEN %s AND %s
            ORDER BY date DESC
        """, (id, user_id, start_date, end_date))
        milk_records = cursor.fetchall()
        
        # Get health records in date range
        cursor.execute("""
            SELECT * FROM health_records
            WHERE cattle_id = %s AND user_id = %s
            AND DATE(created_at) BETWEEN %s AND %s
            ORDER BY created_at DESC
        """, (id, user_id, start_date, end_date))
        health_records = cursor.fetchall()
        
        # Calculate statistics
        cursor.execute("""
            SELECT 
                COALESCE(SUM(milk_liters), 0) as total_milk,
                COALESCE(AVG(milk_liters), 0) as avg_milk,
                COALESCE(SUM(income), 0) as total_income,
                COUNT(*) as total_records
            FROM milk_records
            WHERE cattle_id = %s AND user_id = %s
            AND date BETWEEN %s AND %s
        """, (id, user_id, start_date, end_date))
        stats = cursor.fetchone()
        
        cursor.close()
        connection.close()
        
        # Generate PDF
        buffer = io.BytesIO()
        doc = SimpleDocTemplate(buffer, pagesize=A4, topMargin=0.5*inch, bottomMargin=0.5*inch)
        
        # Styles
        styles = getSampleStyleSheet()
        title_style = ParagraphStyle(
            'CustomTitle',
            parent=styles['Heading1'],
            fontSize=24,
            textColor=colors.HexColor('#667eea'),
            spaceAfter=30,
            alignment=TA_CENTER,
            fontName='Helvetica-Bold'
        )
        
        heading_style = ParagraphStyle(
            'CustomHeading',
            parent=styles['Heading2'],
            fontSize=16,
            textColor=colors.HexColor('#1f2937'),
            spaceAfter=12,
            spaceBefore=20,
            fontName='Helvetica-Bold'
        )
        
        normal_style = ParagraphStyle(
            'CustomNormal',
            parent=styles['Normal'],
            fontSize=10,
            textColor=colors.HexColor('#374151'),
            fontName='Helvetica'
        )
        
        # Build PDF content
        story = []
        
        # Title
        story.append(Paragraph(f"Cattle Report - {cattle['name']}", title_style))
        story.append(Spacer(1, 0.2*inch))
        
        # Report period
        period_text = f"<b>Report Period:</b> {start_date} to {end_date}"
        story.append(Paragraph(period_text, normal_style))
        story.append(Paragraph(f"<b>Generated On:</b> {datetime.now().strftime('%B %d, %Y at %I:%M %p')}", normal_style))
        story.append(Spacer(1, 0.3*inch))
        
        # Cattle Information
        story.append(Paragraph("Cattle Information", heading_style))
        
        cattle_data = [
            ['Field', 'Value'],
            ['ID', f"#{cattle['tag_no'] or cattle['id']}"],
            ['Name', cattle['name']],
            ['Breed', cattle['breed']],
            ['Age', f"{cattle['age']} years"],
            ['Gender', cattle['gender']],
            ['Health Status', cattle['health']],
        ]
        
        cattle_table = Table(cattle_data, colWidths=[2*inch, 4*inch])
        cattle_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#667eea')),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
            ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, 0), 11),
            ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
            ('BACKGROUND', (0, 1), (-1, -1), colors.white),
            ('TEXTCOLOR', (0, 1), (-1, -1), colors.HexColor('#374151')),
            ('FONTNAME', (0, 1), (-1, -1), 'Helvetica'),
            ('FONTSIZE', (0, 1), (-1, -1), 10),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#e5e7eb')),
            ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#f9fafb')]),
        ]))
        
        story.append(cattle_table)
        story.append(Spacer(1, 0.3*inch))
        
        # Production Statistics
        story.append(Paragraph("Production Statistics", heading_style))
        
        stats_data = [
            ['Metric', 'Value'],
            ['Total Production', f"{float(stats['total_milk']):.1f} Liters"],
            ['Average Daily Yield', f"{float(stats['avg_milk']):.1f} Liters"],
            ['Total Income', f"₹{float(stats['total_income']):.2f}"],
            ['Total Records', str(stats['total_records'])],
        ]
        
        stats_table = Table(stats_data, colWidths=[3*inch, 3*inch])
        stats_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#667eea')),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
            ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, 0), 11),
            ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
            ('BACKGROUND', (0, 1), (-1, -1), colors.white),
            ('TEXTCOLOR', (0, 1), (-1, -1), colors.HexColor('#374151')),
            ('FONTNAME', (0, 1), (-1, -1), 'Helvetica'),
            ('FONTSIZE', (0, 1), (-1, -1), 10),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#e5e7eb')),
            ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#f9fafb')]),
        ]))
        
        story.append(stats_table)
        story.append(Spacer(1, 0.3*inch))
        
        # Milk Production Records
        if milk_records:
            story.append(Paragraph("Milk Production Records", heading_style))
            
            milk_data = [['Date', 'Morning (L)', 'Evening (L)', 'Total (L)', 'Rate (₹/L)', 'Income (₹)']]
            
            for record in milk_records:
                date_str = record['date'].strftime('%b %d, %Y') if isinstance(record['date'], datetime) else str(record['date'])
                milk_data.append([
                    date_str,
                    f"{float(record['morning_liters']):.1f}",
                    f"{float(record['evening_liters']):.1f}",
                    f"{float(record['milk_liters']):.1f}",
                    f"₹{float(record['rate']):.2f}",
                    f"₹{float(record['income']):.2f}"
                ])
            
            milk_table = Table(milk_data, colWidths=[1.3*inch, 1*inch, 1*inch, 1*inch, 1.2*inch, 1.2*inch])
            milk_table.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#22c55e')),
                ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
                ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
                ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                ('FONTSIZE', (0, 0), (-1, 0), 9),
                ('BOTTOMPADDING', (0, 0), (-1, 0), 8),
                ('BACKGROUND', (0, 1), (-1, -1), colors.white),
                ('TEXTCOLOR', (0, 1), (-1, -1), colors.HexColor('#374151')),
                ('FONTNAME', (0, 1), (-1, -1), 'Helvetica'),
                ('FONTSIZE', (0, 1), (-1, -1), 8),
                ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#e5e7eb')),
                ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#f0fdf4')]),
            ]))
            
            story.append(milk_table)
            story.append(Spacer(1, 0.3*inch))
        
        # Health Records
        if health_records:
            story.append(PageBreak())
            story.append(Paragraph("Health & Medical Records", heading_style))
            
            for i, record in enumerate(health_records):
                date_str = record['created_at'].strftime('%b %d, %Y') if isinstance(record['created_at'], datetime) else str(record['created_at'])
                
                health_info = f"""
                <b>Date:</b> {date_str}<br/>
                <b>Issue:</b> {record['issue']}<br/>
                <b>Treatment:</b> {record['treatment']}<br/>
                <b>Veterinarian:</b> {record['vet_name']}<br/>
                """
                
                if record['next_checkup']:
                    next_date = record['next_checkup'].strftime('%b %d, %Y') if isinstance(record['next_checkup'], datetime) else str(record['next_checkup'])
                    health_info += f"<b>Next Checkup:</b> {next_date}"
                
                story.append(Paragraph(health_info, normal_style))
                
                if i < len(health_records) - 1:
                    story.append(Spacer(1, 0.2*inch))
        
        # Build PDF
        doc.build(story)
        
        buffer.seek(0)
        
        filename = f"cattle_{id}_report_{start_date}_to_{end_date}.pdf"
        
        return send_file(
            buffer,
            as_attachment=True,
            download_name=filename,
            mimetype='application/pdf'
        )
    
    except Exception as e:
        if cursor:
            cursor.close()
        if connection:
            connection.close()
        return f"Error generating PDF: {str(e)}", 500
