import json
import logging
import os
import pymysql
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
            connect_timeout=5,
            cursorclass=pymysql.cursors.DictCursor  # Return results as dictionaries
        )
        return conn
    except Exception as e:
        logger.error("Database connection error: %s", str(e))
        raise

def lambda_handler(event, context):
    """Lambda function to get trip details from Aurora MySQL."""
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
        
        # Log important information for debugging
        logger.info(f'Fetching trip {trip_id} for user {user_email}')
        
        # Get database connection
        conn = get_db_connection()
        
        try:
            with conn.cursor() as cursor:
                # Get trip details with authorization check
                trip_sql = """
                SELECT t.* 
                FROM trips t
                JOIN users u ON t.user_id = u.id
                WHERE t.id = %s AND u.email = %s
                """
                
                cursor.execute(trip_sql, (trip_id, user_email))
                trip_result = cursor.fetchone()
                
                if not trip_result:
                    logger.warning(f'Trip {trip_id} not found or not owned by user {user_email}')
                    return format_response(403, {'error': 'Trip not found or you do not have permission to access it'})
                
                # Convert date objects to strings for JSON serialization
                for key, value in trip_result.items():
                    if isinstance(value, (date, datetime)):
                        trip_result[key] = value.isoformat()
                
                logger.info(f'Successfully retrieved trip details for trip {trip_id}')
                
                return format_response(200, {
                    'trip': trip_result
                })
                
        except Exception as db_error:
            logger.error(f"Database error: {str(db_error)}", exc_info=True)
            raise
        finally:
            conn.close()
            
    except Exception as e:
        logger.error(f'Error getting trip details: {str(e)}', exc_info=True)
        return format_response(500, {
            'error': 'Failed to get trip details',
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
