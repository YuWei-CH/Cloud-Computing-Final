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
            connect_timeout=5
        )
        return conn
    except Exception as e:
        logger.error("Database connection error: %s", str(e))
        raise

def lambda_handler(event, context):
    """Lambda function to delete a trip and its related records."""
    logger.info('Received event: %s', json.dumps(event))
    
    try:
        # Extract trip_id from the path parameters
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
        
        logger.info(f'Attempting to delete trip {trip_id} for user {user_email}')
        
        # Get database connection
        conn = get_db_connection()
        
        try:
            with conn.cursor() as cursor:
                # Start transaction
                conn.begin()
                
                # Verify the trip belongs to the user
                check_ownership_sql = """
                SELECT t.id FROM trips t
                JOIN users u ON t.user_id = u.id
                WHERE t.id = %s AND u.email = %s
                """
                
                cursor.execute(check_ownership_sql, (trip_id, user_email))
                trip_result = cursor.fetchone()
                
                if not trip_result:
                    logger.error(f'Trip {trip_id} not found or not owned by {user_email}')
                    return format_response(403, {'error': 'Trip not found or not authorized to delete'})
                
                # 1. Find all everyday entries for this trip
                cursor.execute("SELECT id FROM everyday WHERE trip_id = %s", (trip_id,))
                everyday_ids = [row[0] for row in cursor.fetchall()]
                
                # 2. Delete all everyday_locations entries for these everyday records
                if everyday_ids:
                    placeholders = ', '.join(['%s'] * len(everyday_ids))
                    cursor.execute(f"DELETE FROM everyday_locations WHERE everyday_id IN ({placeholders})", everyday_ids)
                    logger.info(f'Deleted everyday_locations for trip {trip_id}')
                
                # 3. Delete all everyday entries
                cursor.execute("DELETE FROM everyday WHERE trip_id = %s", (trip_id,))
                logger.info(f'Deleted everyday entries for trip {trip_id}')
                
                # 4. Delete the trip itself
                cursor.execute("DELETE FROM trips WHERE id = %s", (trip_id,))
                logger.info(f'Deleted trip {trip_id}')
                
                # Commit the transaction
                conn.commit()
                logger.info(f'Successfully deleted trip {trip_id} and all related data')
                
                return format_response(200, {
                    'success': True,
                    'message': 'Trip deleted successfully',
                    'tripId': trip_id
                })
                
        except Exception as db_error:
            # Roll back in case of error
            conn.rollback()
            logger.error(f"Database error: {str(db_error)}")
            raise
        finally:
            conn.close()
            
    except Exception as e:
        logger.error(f'Error deleting trip: {str(e)}', exc_info=True)
        return format_response(500, {
            'error': 'Failed to delete trip',
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
