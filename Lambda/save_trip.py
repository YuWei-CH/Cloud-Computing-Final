# save_trip_lambda.py
import json
import logging
from uuid import uuid4
from datetime import datetime
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
            connect_timeout=5
        )
        return conn
    except Exception as e:
        logger.error("Database connection error: %s", str(e))
        raise

def lambda_handler(event, context):
    """Lambda function to save trip data to Aurora MySQL."""
    logger.info('Received event: %s', json.dumps(event))
    
    try:
        # Parse the body if it's a string (from API Gateway)
        if 'body' in event and isinstance(event['body'], str):
            request_body = json.loads(event['body'])
        else:
            request_body = event.get('body', event)
        
        # Get user email from headers for authentication or from trip data as fallback
        headers = event.get('headers', {}) or {}
        user_email = headers.get('X-User-Email') or headers.get('x-user-email')
        
        # Extract data from the request
        trip = request_body.get('trip', {})
        locations = request_body.get('locations', [])
        everyday = request_body.get('everyday', [])
        everyday_locations = request_body.get('everyday_locations', [])
        
        # If user_email not in headers, try to get it from trip object
        if not user_email and trip.get('user_id'):
            logger.info('Using user_id from trip object: %s', trip.get('user_id'))
            user_email = trip.get('user_id')
        
        if not user_email:
            logger.error('Authentication failed: No user email provided')
            return format_response(401, {'error': 'User email not provided'})
        
        # Validate required trip data
        if not trip or not trip.get('start_city') or not trip.get('duration'):
            logger.error('Validation failed: Missing required trip data')
            return format_response(400, {'error': 'Missing required trip data'})
        
        # Log DB connection attempt
        logger.info('Attempting database connection to %s/%s as %s', DB_HOST, DB_NAME, DB_USER)
        
        # Get database connection
        conn = get_db_connection()
        logger.info('Database connection successful')
        
        try:
            with conn.cursor() as cursor:
                # Start transaction
                conn.begin()
                
                # Check if user exists, look up their UUID by email
                check_user_sql = """
                SELECT id FROM users WHERE email = %s LIMIT 1
                """
                
                cursor.execute(check_user_sql, (user_email,))
                user_result = cursor.fetchone()
                
                if user_result:
                    # Use existing user ID (UUID)
                    user_id = user_result[0]
                    logger.info(f"Found user with email {user_email}, ID: {user_id}")
                else:
                    # Create new user with a UUID
                    user_id = str(uuid4())
                    logger.info(f"User {user_email} not found, creating new user record with ID: {user_id}")
                    
                    # Create user record with UUID as id and store email in email field
                    create_user_sql = """
                    INSERT INTO users (id, email, username, created_at)
                    VALUES (%s, %s, %s, %s)
                    """
                    
                    username = user_email.split('@')[0]  # Extract username from email
                    cursor.execute(create_user_sql, (
                        user_id,           # UUID as id
                        user_email,        # Store email in email field
                        username,          # Username
                        datetime.now().isoformat()
                    ))
                
                # Generate UUID for trip
                trip_id = str(uuid4())
                
                # 1. Save the main trip record using user's UUID, not email
                trip_sql = """
                INSERT INTO trips (id, user_id, start_city, end_city, duration, status, start_date, created_at)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                """
                
                cursor.execute(trip_sql, (
                    trip_id,
                    user_id,         # Use UUID instead of email
                    trip.get('start_city'),
                    trip.get('end_city'),
                    trip.get('duration'),
                    trip.get('status', 'Planning'),
                    trip.get('start_date'),
                    datetime.now().isoformat()
                ))
                
                # 2. Save all location records with duplication check
                location_id_map = {}  # Map original IDs to new UUIDs
                
                for location in locations:
                    original_id = location.get('id')
                    location_name = location.get('name')
                    location_address = location.get('address')
                    
                    # Check if location with this address already exists instead of name
                    check_location_sql = """
                    SELECT id FROM locations WHERE address = %s LIMIT 1
                    """
                    
                    cursor.execute(check_location_sql, (location_address,))
                    existing_location = cursor.fetchone()
                    
                    if existing_location:
                        # Use existing location ID
                        location_id = existing_location[0]
                        logger.info(f"Using existing location with address: {location_address}, ID: {location_id}")
                    else:
                        # Create new location ID and insert
                        location_id = str(uuid4())
                        
                        location_sql = """
                        INSERT INTO locations (id, name, address)
                        VALUES (%s, %s, %s)
                        """
                        
                        cursor.execute(location_sql, (
                            location_id,
                            location_name,
                            location.get('address')
                        ))
                        logger.info(f"Created new location: {location_name} with ID: {location_id}")
                    
                    # Map the original ID to either the existing or new ID
                    location_id_map[original_id] = location_id
                
                # 3. Save everyday records
                day_id_map = {}  # Map original day IDs to new UUIDs
                
                for day in everyday:
                    original_id = day.get('id')
                    day_id = str(uuid4())
                    day_id_map[original_id] = day_id
                    
                    day_sql = """
                    INSERT INTO everyday (id, trip_id, current_city, day_number, start_location)
                    VALUES (%s, %s, %s, %s, %s)
                    """
                    
                    cursor.execute(day_sql, (
                        day_id,
                        trip_id,
                        day.get('current_city'),
                        day.get('day_number'),
                        day.get('start_location')
                    ))
                
                # 4. Save everyday_locations mappings
                for relation in everyday_locations:
                    original_day_id = relation.get('everyday_id')
                    original_location_id = relation.get('location_id')
                    
                    # Get the new UUIDs using our mapping
                    new_day_id = day_id_map.get(original_day_id)
                    new_location_id = location_id_map.get(original_location_id)
                    
                    if new_day_id and new_location_id:
                        relation_sql = """
                        INSERT INTO everyday_locations (id, everyday_id, location_id)
                        VALUES (%s, %s, %s)
                        """
                        
                        cursor.execute(relation_sql, (
                            str(uuid4()),
                            new_day_id,
                            new_location_id
                        ))
                
                # Commit the transaction
                conn.commit()
        except Exception as db_error:
            # Roll back in case of error
            conn.rollback()
            logger.error("Database error: %s", str(db_error))
            raise
        finally:
            conn.close()
        
        # Return success with the trip ID
        return format_response(200, {
            'message': 'Trip saved successfully',
            'tripId': trip_id
        })
        
    except Exception as e:
        logger.error('Error saving trip: %s', str(e), exc_info=True)
        return format_response(500, {
            'error': 'Failed to save trip',
            'details': str(e)
        })

def format_response(status_code, body):
    """Helper to format response in API Gateway format"""
    return {
        'statusCode': status_code,
        'headers': {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Headers': 'Content-Type,X-User-Email'
        },
        'body': json.dumps(body)
    }