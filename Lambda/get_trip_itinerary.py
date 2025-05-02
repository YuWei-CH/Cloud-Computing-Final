import json
import logging
import os
import pymysql

# Configure logging
logger = logging.getLogger()
logger.setLevel(logging.INFO)

# Database connection variables from environment
DB_HOST = os.environ.get('DB_HOST')
DB_NAME = os.environ.get('DB_NAME')
DB_USER = os.environ.get('DB_USER')
DB_PASSWORD = os.environ.get('DB_PASSWORD')

# Initialize database connection
def get_db_connection():
    try:
        if not all([DB_HOST, DB_NAME, DB_USER, DB_PASSWORD]):
            raise ValueError("Missing required database environment variables")
            
        conn = pymysql.connect(
            host=DB_HOST,
            user=DB_USER,
            password=DB_PASSWORD,
            database=DB_NAME,
            connect_timeout=5,
            cursorclass=pymysql.cursors.DictCursor
        )
        return conn
    except Exception as e:
        logger.error("Database connection error: %s", str(e))
        raise

def lambda_handler(event, context):
    """Lambda function to get trip itinerary details from Aurora MySQL."""
    logger.info('Received event: %s', json.dumps(event))
    
    try:
        # Get trip ID from path parameters
        trip_id = event.get('pathParameters', {}).get('trip_id')
        
        if not trip_id:
            logger.error('Trip ID not provided')
            return format_response(400, {'error': 'Trip ID is required'})
        
        # Get user email from headers for authentication
        headers = event.get('headers', {}) or {}
        user_email = headers.get('X-User-Email') or headers.get('x-user-email')
        
        if not user_email:
            logger.error('Authentication failed: No user email provided')
            return format_response(401, {'error': 'User email not provided'})
        
        # Get database connection
        conn = get_db_connection()
        
        try:
            with conn.cursor() as cursor:
                # Check if user has permission to access this trip
                check_permission_sql = """
                SELECT t.id 
                FROM trips t
                JOIN users u ON t.user_id = u.id
                WHERE t.id = %s AND u.email = %s
                """
                
                cursor.execute(check_permission_sql, (trip_id, user_email))
                permission_result = cursor.fetchone()
                
                if not permission_result:
                    logger.error(f'User {user_email} does not have permission to access trip {trip_id}')
                    return format_response(403, {'error': 'You do not have permission to access this trip'})
                
                # Modified SQL query to not include the non-existent l.description column
                activities_sql = """
                SELECT el.id, ed.day_number, l.name, l.address, ed.current_city
                FROM everyday_locations el
                JOIN everyday ed ON el.everyday_id = ed.id
                JOIN locations l ON el.location_id = l.id
                WHERE ed.trip_id = %s
                ORDER BY ed.day_number
                """
                
                cursor.execute(activities_sql, (trip_id,))
                activities = cursor.fetchall()
                
                # Process activities to add description field for frontend compatibility
                for activity in activities:
                    # Add an empty description field or use address as a fallback
                    activity['description'] = activity.get('address', '') or ''
                
                # Return the activities
                return format_response(200, {
                    'activities': activities
                })
                
        except Exception as db_error:
            logger.error(f"Database error: {str(db_error)}", exc_info=True)
            raise
        finally:
            conn.close()
            
    except Exception as e:
        logger.error(f'Error getting trip itinerary: {str(e)}', exc_info=True)
        return format_response(500, {
            'error': 'Failed to get trip itinerary',
            'details': str(e)
        })

def format_response(status_code, body):
    """Helper to format response in API Gateway format"""
    return {
        'statusCode': status_code,
        'headers': {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Headers': 'Content-Type,X-User-Email',
            'Access-Control-Allow-Methods': 'OPTIONS,GET,POST,PUT,DELETE'
        },
        'body': json.dumps(body)
    }
