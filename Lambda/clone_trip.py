import json
import logging
import os
import pymysql
from datetime import datetime
from uuid import uuid4

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
            cursorclass=pymysql.cursors.DictCursor  # Return results as dictionaries
        )
        return conn
    except Exception as e:
        logger.error("Database connection error: %s", str(e))
        raise

def lambda_handler(event, context):
    """Lambda function to clone a trip from an existing trip."""
    logger.info('Received event: %s', json.dumps(event))
    
    try:
        # Parse the request body if it's a string (from API Gateway)
        if 'body' in event and isinstance(event['body'], str):
            request_body = json.loads(event['body'])
        else:
            request_body = event.get('body', {})
        
        # Extract the original trip ID from the path parameters
        original_trip_id = event.get('pathParameters', {}).get('trip_id')
        
        if not original_trip_id:
            logger.error('Original trip ID not provided in path parameters')
            return format_response(400, {'error': 'Original trip ID is required'})
        
        # Get user email from headers for authentication
        headers = event.get('headers', {}) or {}
        user_email = headers.get('X-User-Email') or headers.get('x-user-email')
        
        if not user_email:
            logger.error('Authentication failed: No user email provided')
            return format_response(401, {'error': 'User email not provided'})
        
        # Extract new trip data from request body
        new_start_date = request_body.get('start_date')
        
        if not new_start_date:
            logger.error('New start date not provided')
            return format_response(400, {'error': 'New start date is required'})
        
        # Connect to database
        conn = get_db_connection()
        
        try:
            with conn.cursor() as cursor:
                # Start transaction
                conn.begin()
                
                # Verify user has access to the original trip
                logger.info(f'Verifying user {user_email} has access to trip {original_trip_id}')
                check_access_sql = """
                SELECT t.*, u.id as user_id 
                FROM trips t
                JOIN users u ON t.user_id = u.id
                WHERE t.id = %s AND u.email = %s
                """
                
                cursor.execute(check_access_sql, (original_trip_id, user_email))
                original_trip = cursor.fetchone()
                
                if not original_trip:
                    logger.error(f'Trip {original_trip_id} not found or user does not have access')
                    return format_response(403, {'error': 'Trip not found or you do not have permission to access it'})
                
                # Generate new trip ID
                new_trip_id = str(uuid4())
                
                # Create the new trip record with the new start date
                # Note: Make sure we match the exact columns in the trips table
                logger.info(f'Creating new trip {new_trip_id} cloned from {original_trip_id}')
                new_trip_sql = """
                INSERT INTO trips (
                    id, user_id, start_city, end_city, 
                    duration, status, start_date, created_at
                )
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                """
                
                cursor.execute(new_trip_sql, (
                    new_trip_id,
                    original_trip['user_id'],
                    original_trip['start_city'],
                    original_trip['end_city'],
                    original_trip['duration'],
                    'Planning',  # Always set status to "Planning" for new cloned trips
                    new_start_date,
                    datetime.now().isoformat()
                ))
                
                # Get all everyday records for the original trip
                logger.info(f'Fetching everyday records for trip {original_trip_id}')
                everyday_sql = """
                SELECT * FROM everyday WHERE trip_id = %s
                """
                
                cursor.execute(everyday_sql, (original_trip_id,))
                everyday_records = cursor.fetchall()
                
                # Create mapping for original to new everyday IDs
                everyday_id_map = {}
                
                # Clone all everyday records
                for day in everyday_records:
                    original_day_id = day['id']
                    new_day_id = str(uuid4())
                    everyday_id_map[original_day_id] = new_day_id
                    
                    logger.info(f'Cloning everyday record {original_day_id} to {new_day_id}')
                    new_day_sql = """
                    INSERT INTO everyday (
                        id, trip_id, current_city, day_number, start_location
                    )
                    VALUES (%s, %s, %s, %s, %s)
                    """
                    
                    cursor.execute(new_day_sql, (
                        new_day_id,
                        new_trip_id,
                        day['current_city'],
                        day['day_number'],
                        day['start_location']
                    ))
                
                # For each everyday record, clone its everyday_locations
                for original_day_id, new_day_id in everyday_id_map.items():
                    logger.info(f'Cloning everyday_locations for day {original_day_id}')
                    
                    # Get all everyday_locations for this day
                    locations_sql = """
                    SELECT el.*, l.name, l.address
                    FROM everyday_locations el
                    JOIN locations l ON el.location_id = l.id
                    WHERE el.everyday_id = %s
                    """
                    
                    cursor.execute(locations_sql, (original_day_id,))
                    location_records = cursor.fetchall()
                    
                    # Clone all location mappings
                    for location in location_records:
                        # We'll use the same location record, just create a new mapping
                        new_mapping_id = str(uuid4())
                        
                        logger.info(f'Cloning mapping for location {location["location_id"]} to day {new_day_id}')
                        new_mapping_sql = """
                        INSERT INTO everyday_locations (
                            id, everyday_id, location_id
                        )
                        VALUES (%s, %s, %s)
                        """
                        
                        cursor.execute(new_mapping_sql, (
                            new_mapping_id,
                            new_day_id,
                            location['location_id']
                        ))
                
                # Commit the transaction
                conn.commit()
                logger.info(f'Successfully cloned trip {original_trip_id} to {new_trip_id}')
                
                # For UI purposes, return the display title (not stored in DB)
                display_title = f"Trip from {original_trip['start_city']} to {original_trip['end_city']}"
                
                return format_response(200, {
                    'message': 'Trip cloned successfully',
                    'original_trip_id': original_trip_id,
                    'new_trip_id': new_trip_id,
                    'displayTitle': display_title
                })
                
        except Exception as db_error:
            # Roll back in case of error
            conn.rollback()
            logger.error(f"Database error: {str(db_error)}")
            raise
        finally:
            conn.close()
            
    except Exception as e:
        logger.error(f'Error cloning trip: {str(e)}', exc_info=True)
        return format_response(500, {
            'error': 'Failed to clone trip',
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
            'Access-Control-Allow-Methods': 'OPTIONS,POST'
        },
        'body': json.dumps(body)
    }
