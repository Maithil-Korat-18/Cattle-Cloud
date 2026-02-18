from flask import Blueprint, render_template, request, redirect, url_for, session, jsonify
from db import get_db
from datetime import datetime, timedelta
cattle_bp = Blueprint("cattle", __name__)
import math

def get_breed_image(breed):
    """Return appropriate image URL based on breed"""
    breed_images = {
        'Gir': 'https://lh3.googleusercontent.com/aida-public/AB6AXuA4JJa-xHuUuplRJQ2Ns_c6zNRi8aNKFxWPSpmHVWTM15IMzRsoPp-gITVJc0pi_YA2Vx7ICmci9QkbCI-WfUzpjP0SD7uCbKzczHuBokskKwWRkfLL6S2FT-9L7h6wIrpwQ7UYKUguUPJGt2kPChbj_yhfsULkL3yVQlezVVhsz8qusjaenYlnnrjjo9FGqRooMXXbyDc9XndaRlWQCOQO-U1b-1VaDFuXDeKWsi07U-c6E8x-i_0AavlY46o4R-9WsxztHvt1JYw',
        'Jersey': 'https://lh3.googleusercontent.com/aida-public/AB6AXuCxkKQZN0OmXfMcEoJyWfzH_NRhQa3MH6Ng6VvfZ7MYaYO7R3yKlQOVbR9EQr8lJ-4XGv9N5pN8JqR3_vK7NdJjBvHfR5UxKmRzQxLjCvKlRjBvFfZxRmJzNxLvRjCvNlHfR5UxRmJzCxLvRjBvNlHfZ5UxKmJzRxLvRjCvFl',
        'Holstein': 'https://lh3.googleusercontent.com/aida-public/AB6AXuDjTvN5RnMxCvKlQxRjBvHfZxRmNzCxLvRjBvNl8F5UxKmJzQxLvRjCvKlHfR5UxRmJzNxLvRjCvNlHfZ5UxKmJzRxLvRjBvFlHfR5UxRmJzCxLvRjBvNlHfZ5UxKmJzRxLvRjCvFlHfR5UxRmJzCxLvRjBvNl',
        'Sahiwal': 'https://lh3.googleusercontent.com/aida-public/AB6AXuBxRmNzCxLvRjBvNl8F5UxKmJzQxLvRjCvKlHfR5UxRmJzNxLvRjCvNlHfZ5UxKmJzRxLvRjBvFlHfR5UxRmJzCxLvRjBvNlHfZ5UxKmJzRxLvRjCvFlHfR5UxRmJzCxLvRjBvNlHfZ5UxKmJzRxLvRjCvFl',
        'Red Sindhi': 'https://lh3.googleusercontent.com/aida-public/AB6AXuCxKmJzQxLvRjCvKlHfR5UxRmJzNxLvRjCvNlHfZ5UxKmJzRxLvRjBvFlHfR5UxRmJzCxLvRjBvNlHfZ5UxKmJzRxLvRjCvFlHfR5UxRmJzCxLvRjBvNlHfZ5UxKmJzRxLvRjCvFlHfR5UxRmJzCxLvRjBvNl',
    }
    # Default image if breed not found
    return breed_images.get(breed, 'https://lh3.googleusercontent.com/aida-public/AB6AXuA4JJa-xHuUuplRJQ2Ns_c6zNRi8aNKFxWPSpmHVWTM15IMzRsoPp-gITVJc0pi_YA2Vx7ICmci9QkbCI-WfUzpjP0SD7uCbKzczHuBokskKwWRkfLL6S2FT-9L7h6wIrpwQ7UYKUguUPJGt2kPChbj_yhfsULkL3yVQlezVVhsz8qusjaenYlnnrjjo9FGqRooMXXbyDc9XndaRlWQCOQO-U1b-1VaDFuXDeKWsi07U-c6E8x-i_0AavlY46o4R-9WsxztHvt1JYw')

def calculate_cattle_stats(cattle_id, user_id):
    """Calculate daily yield and status for a cattle"""
    connection = get_db()
    if not connection:
        return {'yield': 0.0, 'status': 'Unknown', 'badge': 'dry', 'health': 'Good'}
    
    cursor = connection.cursor(dictionary=True)
    
    # Get average daily yield from last 7 days
    seven_days_ago = datetime.now().date() - timedelta(days=7)
    cursor.execute("""
        SELECT AVG(milk_liters) as avg_yield
        FROM milk_records
        WHERE cattle_id = %s AND user_id = %s AND date >= %s
    """, (cattle_id, user_id, seven_days_ago))
    
    result = cursor.fetchone()
    avg_yield = float(result['avg_yield']) if result and result['avg_yield'] else 0.0
    
    # Determine status based on yield and health
    cursor.execute("""
        SELECT health FROM cattle WHERE id = %s AND user_id = %s
    """, (cattle_id, user_id))
    
    cattle_data = cursor.fetchone()
    health = cattle_data['health'] if cattle_data else 'Good'
    
    # Status logic
    if health == 'Poor':
        status = 'Fever'
        badge = 'critical'
    elif avg_yield == 0:
        status = 'Resting'
        badge = 'dry'
    elif avg_yield < 10:
        status = 'Low'
        badge = 'warning'
    elif avg_yield >= 10 and avg_yield < 20:
        status = 'Growth'
        badge = 'healthy'
    else:
        status = 'Optimal'
        badge = 'healthy'
    
    cursor.close()
    connection.close()
    return {
        'yield': round(avg_yield, 1),
        'status': status,
        'badge': badge,
        'health': health
    }

@cattle_bp.route('/cattle')
def cattle_herd():
    """Main cattle herd page with pagination"""
    user_id = session.get('user_id')
    if not user_id:
        return redirect(url_for('auth.login'))
    
    page = request.args.get('page', 1, type=int)
    filter_type = request.args.get('filter', 'all')
    search_query = request.args.get('search', '')
    
    per_page = 6  # Items per page to match grid layout
    
    connection = get_db()
    if not connection:
        return "Database connection error", 500
    
    cursor = connection.cursor(dictionary=True)
    
    # Build base query
    base_query = "FROM cattle WHERE user_id = %s"
    params = [user_id]
    
    # Add search filter
    if search_query:
        base_query += " AND (tag_no LIKE %s OR name LIKE %s OR breed LIKE %s)"
        search_param = f"%{search_query}%"
        params.extend([search_param, search_param, search_param])
    
    # Get all cattle (we'll filter after getting stats)
    query = f"SELECT * {base_query} ORDER BY created_at DESC"
    cursor.execute(query, params)
    all_cattle = cursor.fetchall()
    
    # Enhance cattle data with stats and images
    enhanced_cattle = []
    for cattle in all_cattle:
        stats = calculate_cattle_stats(cattle['id'], user_id)
        cattle['daily_yield'] = stats['yield']
        cattle['status'] = stats['status']
        cattle['badge_type'] = stats['badge']
        cattle['health_status'] = stats['health']
        cattle['image_url'] = get_breed_image(cattle['breed'])
        enhanced_cattle.append(cattle)
    
    # Apply filter after getting stats
    if filter_type == 'lactating':
        enhanced_cattle = [c for c in enhanced_cattle if c['daily_yield'] > 0]
    elif filter_type == 'dry':
        enhanced_cattle = [c for c in enhanced_cattle if c['daily_yield'] == 0]
    elif filter_type == 'unhealthy':
        enhanced_cattle = [c for c in enhanced_cattle if c['health_status'] == 'Poor']
    
    # Calculate pagination after filtering
    total_cattle = len(enhanced_cattle)
    total_pages = math.ceil(total_cattle / per_page) if total_cattle > 0 else 1
    
    # Make sure page is within bounds
    if page > total_pages:
        page = total_pages
    if page < 1:
        page = 1
    
    # Paginate the filtered results
    start_idx = (page - 1) * per_page
    end_idx = min(start_idx + per_page, total_cattle)
    paginated_cattle = enhanced_cattle[start_idx:end_idx]
    
    # Calculate stats for header
    cursor.execute("""
        SELECT COUNT(*) as total FROM cattle WHERE user_id = %s
    """, (user_id,))
    total_population = cursor.fetchone()['total']
    
    # Calculate average daily yield across all cattle
    total_yield = sum(c['daily_yield'] for c in enhanced_cattle)
    avg_daily_yield = total_yield / len(enhanced_cattle) if enhanced_cattle else 0.0
    
    # Count active alerts (Poor health)
    active_alerts = len([c for c in enhanced_cattle if c['health_status'] == 'Poor'])
    
    # Calculate herd efficiency (percentage of healthy cattle)
    healthy_count = len([c for c in enhanced_cattle if c['health_status'] == 'Good'])
    herd_efficiency = (healthy_count / len(enhanced_cattle) * 100) if enhanced_cattle else 0
    
    cursor.close()
    connection.close()
    
    # Generate page numbers for pagination
    page_numbers = []
    if total_pages <= 7:
        page_numbers = list(range(1, total_pages + 1))
    else:
        if page <= 3:
            page_numbers = [1, 2, 3, '...', total_pages]
        elif page >= total_pages - 2:
            page_numbers = [1, '...', total_pages - 2, total_pages - 1, total_pages]
        else:
            page_numbers = [1, '...', page - 1, page, page + 1, '...', total_pages]
    
    return render_template('cattle.html',
                         cattle_list=paginated_cattle,
                         current_page=page,
                         total_pages=total_pages,
                         page_numbers=page_numbers,
                         filter_type=filter_type,
                         search_query=search_query,
                         total_population=total_population,
                         avg_daily_yield=round(avg_daily_yield, 1),
                         active_alerts=active_alerts,
                         herd_efficiency=round(herd_efficiency, 1),
                         user_name=session.get('full_name', 'User'))

@cattle_bp.route('/cattle/add', methods=['POST'])
def add_cattle():
    """Add new cattle via AJAX"""
    user_id = session.get('user_id')
    if not user_id:
        return jsonify({'success': False, 'message': 'Not logged in'}), 401
    
    connection = get_db()
    if not connection:
        return jsonify({'success': False, 'message': 'Database connection error'}), 500
    
    cursor = connection.cursor()
    
    # Get form data
    name = request.form.get('name')
    breed = request.form.get('breed')
    age = request.form.get('age')
    gender = request.form.get('gender', 'Female')
    health = request.form.get('health', 'Good')
    purchase_date = request.form.get('purchase_date')

    # Generate tag number
    cursor.execute("""
        SELECT COUNT(*) FROM cattle WHERE user_id = %s and breed = %s
    """, (user_id,breed))
    count = cursor.fetchone()[0] + 1
    tag_no = f"C-{count:02d}"
    
    # Validate required fields
    if not name or not breed or not age:
        cursor.close()
        connection.close()
        return jsonify({'success': False, 'message': 'Missing required fields'}), 400
    
    try:
        cursor.execute("""
            INSERT INTO cattle (user_id, tag_no, name, breed, age, gender, health, purchase_date)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
        """, (user_id, tag_no, name, breed, age, gender, health, purchase_date if purchase_date else None))
        
        connection.commit()
        cattle_id = cursor.lastrowid
        
        cursor.close()
        connection.close()
        
        return jsonify({
            'success': True,
            'message': 'Cattle added successfully',
            'cattle_id': cattle_id
        })
    except Exception as e:
        cursor.close()
        connection.close()
        return jsonify({
            'success': False,
            'message': str(e)
        }), 400
