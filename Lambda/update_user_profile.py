import json
import os
import pymysql

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
    
    # Define CORS headers to be used in all responses
    cors_headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type,X-User-Email',
        'Access-Control-Allow-Methods': 'OPTIONS,PUT,GET,POST,DELETE'
    }
    
    try:
        # Initialize email variable to None at the beginning
        email = None
        
        # Determine if this is API Gateway proxy format or direct invocation
        is_proxy_format = 'httpMethod' in event and 'headers' in event
        print(f"EVENT FORMAT: {'API Gateway Proxy' if is_proxy_format else 'Direct Invocation'}")
        
        # Extract data from the event based on format
        if is_proxy_format:
            # API Gateway proxy format - standard processing
            # Log the request headers specifically
            if 'headers' in event:
                print("REQUEST HEADERS:", json.dumps(event['headers']))
            else:
                print("NO HEADERS FOUND IN REQUEST")
                
            # Enhanced request debugging information
            print("EVENT STRUCTURE:", {k: type(v).__name__ for k, v in event.items()})
            print("REQUEST CONTEXT:", json.dumps(event.get('requestContext', {})))
            
            # Log the HTTP method
            http_method = event.get('httpMethod', 'UNKNOWN')
            print(f"HTTP METHOD: {http_method}")
            
            # Handle OPTIONS method for CORS preflight requests
            if http_method == 'OPTIONS':
                print("Handling OPTIONS request")
                options_response = {
                    'statusCode': 200,
                    'headers': cors_headers,
                    'body': ''
                }
                print("OPTIONS RESPONSE:", json.dumps(options_response))
                return options_response
            
            # Check headers (case insensitive)
            if 'headers' in event and event['headers']:
                print("HEADERS COUNT:", len(event['headers']))
                headers = event['headers']
                for key in headers:
                    header_value = headers[key]
                    print(f"HEADER: {key} = {header_value}")
                    if key.lower() == 'x-user-email':
                        email = header_value
                        print(f"[SUCCESS] FOUND EMAIL IN HEADER: {email}")
                        break
            
            # Check query parameters
            if not email and 'queryStringParameters' in event and event['queryStringParameters']:
                params = event['queryStringParameters']
                print("QUERY PARAMS:", json.dumps(params))
                if 'email' in params:
                    email = params['email']
                    print(f"[SUCCESS] FOUND EMAIL IN QUERY PARAM: {email}")
            
            # Parse request body if present
            if 'body' in event and event['body']:
                body = json.loads(event['body'])
            else:
                body = {}
        else:
            # Direct invocation format - the event IS the body
            body = event
            print("DIRECT INVOCATION BODY:", json.dumps(body))
            # Extract email directly from body in direct invocation
            email = body.get('email')
            print(f"EXTRACTED EMAIL FROM DIRECT INVOCATION: {email}")
        
        # For API Gateway proxy format, check body if email not found in headers/params
        if is_proxy_format and not email and 'body' in event and event['body']:
            try:
                body = json.loads(event['body'])
                if 'email' in body:
                    email = body.get('email')
                    print(f"[SUCCESS] FOUND EMAIL IN BODY: {email}")
            except Exception as e:
                print(f"ERROR PARSING BODY: {str(e)}")
        
        print(f"EXTRACTED EMAIL: {email}")
        
        if not email:
            print("[ERROR] EMAIL STILL NOT FOUND AFTER CHECKING ALL SOURCES")
            return {
                'statusCode': 401,
                'headers': {**cors_headers, 'Content-Type': 'application/json'},
                'body': json.dumps({
                    'error': 'Email not provided in request',
                    'note': 'API Gateway might not be passing headers correctly'
                })
            }
        
        # Extract profile data
        username = body.get('username')
        print(f"PROCESSING: email={email}, username={username}")
        
        # Create connection to database
        connection = pymysql.connect(
            host=db_config['host'],
            user=db_config['user'],
            password=db_config['password'],
            database=db_config['database'],
            cursorclass=pymysql.cursors.DictCursor
        )
        
        try:
            with connection.cursor() as cursor:
                # Update user profile
                sql = """
                    UPDATE users
                    SET username = %s
                    WHERE email = %s
                """
                cursor.execute(sql, (username, email))
                
                # Check if any row was affected
                affected_rows = cursor.rowcount
                
                if affected_rows == 0:
                    return {
                        'statusCode': 404,
                        'headers': {**cors_headers, 'Content-Type': 'application/json'},
                        'body': json.dumps({'error': 'User not found'})
                    }
                
                # Get updated record
                cursor.execute("SELECT username FROM users WHERE email = %s", (email,))
                updated_fields = cursor.fetchone()
                
            # Commit changes to database
            connection.commit()
            
            return {
                'statusCode': 200,
                'headers': {**cors_headers, 'Content-Type': 'application/json'},
                'body': json.dumps({
                    'message': 'Profile updated successfully',
                    'updatedFields': updated_fields
                })
            }
            
        finally:
            connection.close()
            
    except Exception as e:
        print(f"Error: {str(e)}")
        import traceback
        print(traceback.format_exc())
        return {
            'statusCode': 500,
            'headers': {**cors_headers, 'Content-Type': 'application/json'},
            'body': json.dumps({'error': str(e)})
        }