from flask import Blueprint, render_template, request, jsonify, session, send_file
from datetime import datetime, timedelta
from db import get_db
import io
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch

milk_bp = Blueprint('milk', __name__)

@milk_bp.route('/milk')
def milk_records():
    return render_template('milk_records.html', user_name=session.get('full_name', 'User'))

# ── SUMMARY (real change + real last_month_avg target) ────────
@milk_bp.route('/milk/summary')
def get_summary():
    user_id = session.get('user_id')
    conn = get_db(); cursor = conn.cursor(dictionary=True)
    try:
        today     = datetime.now().date()
        yesterday = today - timedelta(days=1)

        cursor.execute("SELECT COALESCE(SUM(milk_liters),0) AS ty, COALESCE(SUM(morning_liters),0) AS mg, COALESCE(SUM(evening_liters),0) AS ev FROM milk_records WHERE user_id=%s AND date=%s", (user_id, today))
        t = cursor.fetchone()

        cursor.execute("SELECT COALESCE(SUM(milk_liters),0) AS yy FROM milk_records WHERE user_id=%s AND date=%s", (user_id, yesterday))
        y = cursor.fetchone()

        today_total = float(t['ty']); yest_total = float(y['yy'])
        if yest_total > 0:
            pct = round((today_total - yest_total) / yest_total * 100, 1)
        elif today_total > 0:
            pct = 100.0
        else:
            pct = 0.0

        cursor.execute("SELECT COUNT(DISTINCT cattle_id) AS c FROM milk_records WHERE user_id=%s AND date=%s", (user_id, today))
        cnt = cursor.fetchone()['c']
        avg = round(today_total / cnt, 1) if cnt else 0.0

        first_this = today.replace(day=1)
        lm_end   = first_this - timedelta(days=1)
        lm_start = lm_end.replace(day=1)
        cursor.execute("SELECT COALESCE(AVG(ds),0) AS lma FROM (SELECT SUM(milk_liters) AS ds FROM milk_records WHERE user_id=%s AND date BETWEEN %s AND %s GROUP BY date) x", (user_id, lm_start, lm_end))
        lma = round(float(cursor.fetchone()['lma']), 1)

        cursor.close(); conn.close()
        return jsonify(success=True, today_total=round(today_total,1), morning_total=round(float(t['mg']),1),
                       evening_total=round(float(t['ev']),1), change_percent=pct, avg_per_cow=avg, last_month_avg=lma)
    except Exception as e:
        cursor.close(); conn.close()
        return jsonify(success=False, error=str(e)), 500

# ── AVAILABLE CATTLE (exclude already-recorded for chosen date) ─
@milk_bp.route('/milk/available-cattle')
def available_cattle():
    user_id = session.get('user_id')
    date    = request.args.get('date', datetime.now().strftime('%Y-%m-%d'))
    conn = get_db(); cursor = conn.cursor(dictionary=True)
    try:
        cursor.execute("SELECT id, tag_no, name, breed FROM cattle WHERE user_id=%s ORDER BY name", (user_id,))
        all_c = cursor.fetchall()
        cursor.execute("SELECT DISTINCT cattle_id FROM milk_records WHERE user_id=%s AND date=%s", (user_id, date))
        done = {r['cattle_id'] for r in cursor.fetchall()}
        cursor.close(); conn.close()
        return jsonify(success=True, available=[c for c in all_c if c['id'] not in done], all=all_c)
    except Exception as e:
        cursor.close(); conn.close()
        return jsonify(success=False, error=str(e)), 500

# ── RECORDS (paginated) ───────────────────────────────────────
@milk_bp.route('/milk/data')
def get_milk_data():
    user_id  = session.get('user_id')
    page     = request.args.get('page', 1, type=int)
    per_page = request.args.get('per_page', 10, type=int)
    search   = request.args.get('search', '')
    sd       = request.args.get('start_date'); ed = request.args.get('end_date')
    conn = get_db(); cursor = conn.cursor(dictionary=True)
    try:
        q = "SELECT mr.*, c.tag_no, c.name, c.breed FROM milk_records mr LEFT JOIN cattle c ON mr.cattle_id=c.id WHERE mr.user_id=%s"
        p = [user_id]
        if search: q += " AND (c.tag_no LIKE %s OR c.name LIKE %s)"; sp=f"%{search}%"; p+=[sp,sp]
        if sd and ed: q += " AND mr.date BETWEEN %s AND %s"; p+=[sd,ed]
        cursor.execute(q.replace("SELECT mr.*, c.tag_no, c.name, c.breed","SELECT COUNT(*) AS total"), p)
        total = cursor.fetchone()['total']
        q += " ORDER BY mr.date DESC, mr.created_at DESC LIMIT %s OFFSET %s"; p+=[per_page,(page-1)*per_page]
        cursor.execute(q, p); records = cursor.fetchall()
        for r in records:
            if isinstance(r['date'], datetime): r['date']=r['date'].strftime('%Y-%m-%d')
            if isinstance(r.get('created_at'), datetime): r['created_at']=r['created_at'].strftime('%Y-%m-%d %H:%M:%S')
        cursor.close(); conn.close()
        return jsonify(success=True, records=records, total=total, page=page, per_page=per_page, total_pages=(total+per_page-1)//per_page)
    except Exception as e:
        cursor.close(); conn.close()
        return jsonify(success=False, error=str(e)), 500

# ── ADD ───────────────────────────────────────────────────────
@milk_bp.route('/milk/add', methods=['POST'])
def add_milk_record():
    user_id = session.get('user_id')
    try:
        d=request.get_json(); m=float(d.get('morning_liters',0)); ev=float(d.get('evening_liters',0)); r=float(d.get('rate',0))
        conn=get_db(); cursor=conn.cursor()
        cursor.execute("INSERT INTO milk_records (user_id,cattle_id,date,morning_liters,evening_liters,rate,income) VALUES(%s,%s,%s,%s,%s,%s,%s)",
                       (user_id,d.get('cattle_id'),d.get('date'),m,ev,r,(m+ev)*r))
        conn.commit(); cursor.close(); conn.close()
        return jsonify(success=True)
    except Exception as e:
        if 'conn' in locals(): conn.rollback(); cursor.close(); conn.close()
        return jsonify(success=False, error=str(e)), 500

# ── UPDATE ────────────────────────────────────────────────────
@milk_bp.route('/milk/update/<int:id>', methods=['POST'])
def update_milk_record(id):
    user_id = session.get('user_id')
    try:
        d=request.get_json(); m=float(d.get('morning_liters',0)); ev=float(d.get('evening_liters',0)); r=float(d.get('rate',0))
        conn=get_db(); cursor=conn.cursor()
        cursor.execute("UPDATE milk_records SET morning_liters=%s,evening_liters=%s,rate=%s,date=%s,income=%s WHERE id=%s AND user_id=%s",
                       (m,ev,r,d.get('date'),(m+ev)*r,id,user_id))
        conn.commit(); cursor.close(); conn.close()
        return jsonify(success=True)
    except Exception as e:
        if 'conn' in locals(): conn.rollback(); cursor.close(); conn.close()
        return jsonify(success=False, error=str(e)), 500

# ── DELETE ────────────────────────────────────────────────────
@milk_bp.route('/milk/delete/<int:id>', methods=['DELETE'])
def delete_milk_record(id):
    user_id = session.get('user_id')
    try:
        conn=get_db(); cursor=conn.cursor()
        cursor.execute("DELETE FROM milk_records WHERE id=%s AND user_id=%s", (id,user_id))
        conn.commit(); cursor.close(); conn.close()
        return jsonify(success=True)
    except Exception as e:
        if 'conn' in locals(): conn.rollback(); cursor.close(); conn.close()
        return jsonify(success=False, error=str(e)), 500

# ── CATTLE LIST (report dropdown) ─────────────────────────────
@milk_bp.route('/milk/cattle-list')
def get_cattle_list():
    user_id = session.get('user_id')
    conn=get_db(); cursor=conn.cursor(dictionary=True)
    try:
        cursor.execute("SELECT id,tag_no,name,breed FROM cattle WHERE user_id=%s ORDER BY name",(user_id,))
        cattle=cursor.fetchall(); cursor.close(); conn.close()
        return jsonify(success=True, cattle=cattle)
    except Exception as e:
        cursor.close(); conn.close()
        return jsonify(success=False, error=str(e)), 500

# ── GENERATE PDF REPORT ───────────────────────────────────────
@milk_bp.route('/milk/report', methods=['POST'])
def generate_report():
    user_id = session.get('user_id')
    try:
        d=request.get_json(); sd=d.get('start_date'); ed=d.get('end_date'); cid=d.get('cattle_id')
        conn=get_db(); cursor=conn.cursor(dictionary=True)
        q="SELECT mr.date,c.tag_no,c.name,c.breed,mr.morning_liters,mr.evening_liters,mr.milk_liters,mr.rate,mr.income FROM milk_records mr LEFT JOIN cattle c ON mr.cattle_id=c.id WHERE mr.user_id=%s"
        p=[user_id]
        if sd and ed: q+=" AND mr.date BETWEEN %s AND %s"; p+=[sd,ed]
        if cid and cid!='all': q+=" AND mr.cattle_id=%s"; p.append(cid)
        q+=" ORDER BY mr.date DESC"; cursor.execute(q,p); records=cursor.fetchall()
        for r in records:
            if isinstance(r['date'],datetime): r['date']=r['date'].strftime('%Y-%m-%d')
        cursor.close(); conn.close()
        return _pdf(records,sd,ed)
    except Exception as e:
        if 'cursor' in locals(): cursor.close(); conn.close()
        return jsonify(success=False, error=str(e)), 500


def _pdf(records, sd, ed):
    buf=io.BytesIO()
    doc=SimpleDocTemplate(buf,pagesize=A4,rightMargin=30,leftMargin=30,topMargin=30,bottomMargin=30)
    styles=getSampleStyleSheet()
    ts=ParagraphStyle('T',parent=styles['Heading1'],fontSize=18,textColor=colors.HexColor('#667eea'),spaceAfter=8,alignment=1,fontName='Helvetica-Bold')
    ss=ParagraphStyle('S',parent=styles['Normal'],fontSize=10,textColor=colors.HexColor('#6b7280'),spaceAfter=18,alignment=1)
    us=ParagraphStyle('U',parent=styles['Normal'],fontSize=9,spaceAfter=4)
    els=[Paragraph('Milk Production Report',ts),Paragraph(f'Period: {sd}  →  {ed}',ss)]
    td=[['Date','Tag','Name','Morning','Evening','Total','Rate','Income']]
    tm=ti=0
    for r in records:
        td.append([r['date'],r['tag_no'] or 'N/A',(r['name'] or 'N/A')[:14],
                   f"{float(r['morning_liters']):.1f}",f"{float(r['evening_liters']):.1f}",
                   f"{float(r['milk_liters']):.1f}",f"₹{float(r['rate']):.2f}",f"₹{float(r['income']):.2f}"])
        tm+=float(r['milk_liters']); ti+=float(r['income'])
    tbl=Table(td,colWidths=[65,48,78,50,50,45,55,65],repeatRows=1)
    tbl.setStyle(TableStyle([
        ('BACKGROUND',(0,0),(-1,0),colors.HexColor('#667eea')),('TEXTCOLOR',(0,0),(-1,0),colors.whitesmoke),
        ('FONTNAME',(0,0),(-1,0),'Helvetica-Bold'),('FONTSIZE',(0,0),(-1,-1),8),('ALIGN',(0,0),(-1,-1),'CENTER'),
        ('GRID',(0,0),(-1,-1),0.4,colors.grey),('ROWBACKGROUNDS',(0,1),(-1,-1),[colors.white,colors.HexColor('#f9fafb')]),
        ('TOPPADDING',(0,0),(-1,-1),7),('BOTTOMPADDING',(0,0),(-1,-1),7),
    ]))
    els+=[tbl,Spacer(1,0.3*inch)]
    if records:
        for txt in [f'<b>Summary</b>',f'Total Records: {len(records)}',f'Total Milk: {tm:.2f} L',
                    f'Total Income: ₹{ti:.2f}',f'Avg per Record: {tm/len(records):.2f} L']:
            els.append(Paragraph(txt,us))
    else:
        els.append(Paragraph('No records found.',styles['Normal']))
    doc.build(els); buf.seek(0)
    return send_file(buf,mimetype='application/pdf',as_attachment=True,download_name=f'milk_report_{sd}_to_{ed}.pdf')