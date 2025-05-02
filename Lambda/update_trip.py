import json
import logging
import os
import pymysql
from uuid import uuid4
from datetime import date, datetime

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
    """Lambda function to update trip data in Aurora MySQL."""
    logger.info('Received event: %s', json.dumps(event))
    
    try:
        # Parse the body if it's a string (from API Gateway)
        if 'body' in event and isinstance(event['body'], str):
            request_body = json.loads(event['body'])
        else:
            request_body = event.get('body', event)
        
        # Get user email from headers for authentication
        headers = event.get('headers', {}) or {}
        user_email = headers.get('X-User-Email') or headers.get('x-user-email')
        
        # Get trip ID from path parameters
        trip_id = event.get('pathParameters', {}).get('trip_id')
        
        if not trip_id:
            logger.error('Trip ID not provided')
            return format_response(400, {'error': 'Trip ID is required'})
        
        # Extract data from the request
        trip = request_body.get('trip', {})
        activities = request_body.get('activities', [])
        
        # If user_email not in headers, try to get it from trip object
        if not user_email and trip.get('user_id'):
            user_email = trip.get('user_id')
        
        if not user_email:
            logger.error('Authentication failed: No user email provided')
            return format_response(401, {'error': 'User email not provided'})
        
        # Validate required trip data
        if not trip or not trip.get('start_city') or not trip.get('duration'):
            logger.error('Validation failed: Missing required trip data')
            return format_response(400, {'error': 'Missing required trip data'})
        
        # Get database connection
        conn = get_db_connection()
        
        try:
            with conn.cursor() as cursor:
                # Start transaction
                conn.begin()
                
                # Check if user exists and has permission to edit this trip
                check_permission_sql = """
                SELECT t.id 
                FROM trips t
                JOIN users u ON t.user_id = u.id
                WHERE t.id = %s AND u.email = %s
                """
                
                cursor.execute(check_permission_sql, (trip_id, user_email))
                permission_result = cursor.fetchone()
                
                if not permission_result:
                    logger.error(f'User {user_email} does not have permission to edit trip {trip_id}')
                    return format_response(403, {'error': 'You do not have permission to edit this trip'})
                
                # 1. Update the main trip record
                update_trip_sql = """
                UPDATE trips
                SET start_city = %s, end_city = %s, duration = %s, start_date = %s
                WHERE id = %s
                """
                
                cursor.execute(update_trip_sql, (
                    trip.get('start_city'),
                    trip.get('end_city'),
                    trip.get('duration'),
                    trip.get('start_date'),
                    trip_id
                ))
                
                # 2. Process activities
                for activity in activities:
                    if activity.get('_deleted'):
                        # Delete activity if it's marked for deletion
                        if 'id' in activity and not activity['id'].startswith('new-'):
                            # Find the everyday_location entry for this activity
                            find_everyday_location_sql = """
                            SELECT id, everyday_id, location_id
                            FROM everyday_locations
                            WHERE id = %s
                            """
                            
                            cursor.execute(find_everyday_location_sql, (activity['id'],))
                            el_result = cursor.fetchone()
                            
                            if el_result:
                                # Delete the everyday_location entry
                                delete_el_sql = "DELETE FROM everyday_locations WHERE id = %s"
                                cursor.execute(delete_el_sql, (activity['id'],))
                    
                    elif activity.get('_new'):
                        # Create a new activity
                        day_number = activity.get('day_number', 1)
                        
                        # Find the everyday ID for this day number
                        find_everyday_sql = """
                        SELECT id FROM everyday
                        WHERE trip_id = %s AND day_number = %s
                        """
                        
                        cursor.execute(find_everyday_sql, (trip_id, day_number))
                        everyday_result = cursor.fetchone()
                        
                        everyday_id = None
                        
                        if everyday_result:
                            everyday_id = everyday_result[0]
                        else:
                            # Create new everyday record
                            everyday_id = str(uuid4())
                            create_everyday_sql = """
                            INSERT INTO everyday (id, trip_id, day_number, current_city)
                            VALUES (%s, %s, %s, %s)
                            """
                            
                            cursor.execute(create_everyday_sql, (
                                everyday_id,
                                trip_id,
                                day_number,
                                trip.get('start_city')
                            ))
                        
                        # Create or find location - Only store name and address, not description
                        location_name = activity.get('name', 'Unnamed Activity')
                        # Use address if available, or just the name
                        location_address = activity.get('address', location_name)
                        
                        find_location_sql = """
                        SELECT id FROM locations
                        WHERE name = %s AND address = %s
                        LIMIT 1
                        """
                        
                        cursor.execute(find_location_sql, (location_name, location_address))
                        location_result = cursor.fetchone()
                        
                        location_id = None
                        
                        if location_result:
                            location_id = location_result[0]
                        else:
                            # Create new location - Without description field
                            location_id = str(uuid4())
                            create_location_sql = """
                            INSERT INTO locations (id, name, address)
                            VALUES (%s, %s, %s)
                            """
                            
                            cursor.execute(create_location_sql, (
                                location_id,
                                location_name,
                                location_address
                            ))
                        
                        # Create everyday_locations mapping
                        create_el_sql = """
                        INSERT INTO everyday_locations (id, everyday_id, location_id)
                        VALUES (%s, %s, %s)
                        """
                        
                        cursor.execute(create_el_sql, (
                            str(uuid4()),
                            everyday_id,
                            location_id
                        ))
                    
                    elif activity.get('_modified'):
                        # Update existing activity if it's modified
                        if 'id' in activity and not activity['id'].startswith('new-'):
                            # Get the location ID from the everyday_locations table
                            find_location_id_sql = """
                            SELECT location_id
                            FROM everyday_locations
                            WHERE id = %s
                            """
                            
                            cursor.execute(find_location_id_sql, (activity['id'],))
                            location_result = cursor.fetchone()
                            
                            if location_result:
                                location_id = location_result[0]
                                
                                # Update the location name - Description is not stored
                                update_location_sql = """
                                UPDATE locations
                                SET name = %s
                                WHERE id = %s
                                """
                                
                                cursor.execute(update_location_sql, (
                                    activity.get('name', 'Unnamed Activity'),
                                    location_id
                                ))
                
                # Commit the transaction
                conn.commit()
                logger.info(f'Successfully updated trip {trip_id}')
                
                return format_response(200, {
                    'success': True,
                    'message': 'Trip updated successfully',
                    'tripId': trip_id
                })
                
        except Exception as db_error:
            # Roll back in case of error
            conn.rollback()
            logger.error(f"Database error: {str(db_error)}", exc_info=True)
            raise
        finally:
            conn.close()
            
    except Exception as e:
        logger.error(f'Error updating trip: {str(e)}', exc_info=True)
        return format_response(500, {
            'error': 'Failed to update trip',
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
