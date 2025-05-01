import json
import os
import pymysql
import datetime

# Database configuration
db_config = {
    'host': os.environ['DB_HOST'],
    'user': os.environ['DB_USER'],
    'password': os.environ['DB_PASSWORD'],
    'database': os.environ['DB_NAME']
}

def lambda_handler(event, context):
    # Log the entire event for debugging
    print("RECEIVED EVENT:", json.dumps(event))
    
    # Handle direct Lambda invocation for testing
    if not event or (isinstance(event, dict) and len(event) == 0):
        print("Empty event received - likely direct Lambda invocation")
        # For API debugging purposes, return diagnostic information
        return {
            'statusCode': 200,
            'headers': {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': 'Content-Type,X-User-Email',
                'Content-Type': 'application/json'
            },
            'body': json.dumps({
                'message': 'API Gateway Integration Test - No data received',
                'event': event,
                'context': str(context),
                'note': 'This Lambda is receiving an empty event. Check API Gateway integration.'
            })
        }
    
    # Add special diagnostics for API Gateway integration issues
    print("EVENT STRUCTURE:", {k: type(v).__name__ for k, v in event.items()})
    print("EVENT KEYS:", list(event.keys()))
    
    # Handle OPTIONS method for CORS preflight requests
    if event.get('httpMethod') == 'OPTIONS':
        print("Handling OPTIONS request")
        return {
            'statusCode': 200,
            'headers': {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': 'Content-Type,X-User-Email',
                'Access-Control-Allow-Methods': 'OPTIONS,GET',
                'Access-Control-Max-Age': '86400'
            },
            'body': ''
        }
    
    try:
        print("Processing main request path")
        # Extract email from various possible locations
        email = None
        
        # Try headers first (case insensitive)
        if 'headers' in event and event['headers']:
            for key in event['headers']:
                if key.lower() == 'x-user-email':
                    email = event['headers'][key]
                    print(f"Found email in header {key}: {email}")
                    break
        
        # Try query parameters if no email in headers
        if not email and 'queryStringParameters' in event and event['queryStringParameters']:
            if 'email' in event['queryStringParameters']:
                email = event['queryStringParameters']['email']
                print(f"Found email in query parameters: {email}")
        
        # Try path parameters if still no email
        if not email and 'pathParameters' in event and event['pathParameters']:
            if 'email' in event['pathParameters']:
                email = event['pathParameters']['email']
                print(f"Found email in path parameters: {email}")
                
        # Try the request body if it exists
        if not email and 'body' in event and event['body']:
            try:
                body = json.loads(event['body'])
                if 'email' in body:
                    email = body['email']
                    print(f"Found email in request body: {email}")
            except:
                print("Failed to parse request body as JSON")
        
        if not email:
            print("No email found in request - check API Gateway configuration")
            return {
                'statusCode': 401,
                'headers': {
                    'Access-Control-Allow-Origin': '*',
                    'Content-Type': 'application/json'
                },
                'body': json.dumps({
                    'error': 'Email not provided in request',
                    'note': 'Check API Gateway configuration to ensure X-User-Email header is passed to Lambda'
                })
            }
            
        print(f"Using email: {email}")
        
        # Create connection to database
        print("Connecting to database...")
        connection = pymysql.connect(
            host=db_config['host'],
            user=db_config['user'],
            password=db_config['password'],
            database=db_config['database'],
            cursorclass=pymysql.cursors.DictCursor
        )
        print("Database connection successful")
        
        try:
            with connection.cursor() as cursor:
                # Query user data
                sql = """
                    SELECT username, email, weather_preference, environment_preference, 
                           activity_preference, created_at
                    FROM users
                    WHERE email = %s
                """
                print(f"Executing SQL query for email: {email}")
                cursor.execute(sql, (email,))
                user = cursor.fetchone()
                
                if not user:
                    print(f"No user found with email: {email}")
                    return {
                        'statusCode': 404,
                        'headers': {
                            'Access-Control-Allow-Origin': '*',
                            'Content-Type': 'application/json'
                        },
                        'body': json.dumps({'error': 'User not found'})
                    }
                
                print(f"User found: {json.dumps(user, default=str)}")
                
                # Count user's trips (if trips table exists)
                trip_count = 0
                try:
                    cursor.execute("""
                        SELECT COUNT(*) as trip_count
                        FROM trips
                        WHERE user_email = %s
                    """, (email,))
                    result = cursor.fetchone()
                    if result:
                        trip_count = result['trip_count']
                except:
                    # If trips table doesn't exist yet, ignore the error
                    pass
                    
            # Format created_at date if it's a datetime object
            member_since = user['created_at']
            if isinstance(member_since, datetime.datetime):
                member_since = member_since.strftime('%Y-%m-%d %H:%M:%S')
                
            # Format user data for frontend
            user_data = {
                'name': user.get('username', 'User'),  # Use username as display name
                'username': user.get('username', ''),
                'email': user.get('email', ''),
                'memberSince': member_since,
                'tripsCount': trip_count,
                'preferences': {
                    'weather': user.get('weather_preference', 'warm'),
                    'environment': user.get('environment_preference', 'city'),
                    'activity': user.get('activity_preference', 'relaxing')
                }
            }
            
            print(f"Returning user data: {json.dumps(user_data)}")
            return {
                'statusCode': 200,
                'headers': {
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Headers': 'Content-Type,X-User-Email',
                    'Content-Type': 'application/json'
                },
                'body': json.dumps(user_data)
            }
            
        finally:
            connection.close()
            print("Database connection closed")
            
    except Exception as e:
        print(f"ERROR: {str(e)}")
        import traceback
        print(traceback.format_exc())
        return {
            'statusCode': 500,
            'headers': {
                'Access-Control-Allow-Origin': '*',
                'Content-Type': 'application/json'
            },
            'body': json.dumps({'error': str(e)})
        }