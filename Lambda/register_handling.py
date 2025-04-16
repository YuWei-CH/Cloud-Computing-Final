import json
import os
import uuid
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
    try:
        # Log incoming event
        print(f"Received event: {json.dumps(event)}")
        
        # Check if event has a 'body' key
        if 'body' in event:
            # API Gateway integration format
            user_data = json.loads(event['body'])
        else:
            # Direct invocation format
            user_data = event
        
        print(f"Parsed user data: {json.dumps(user_data)}")
        
        # Generate UUID for the user
        user_id = str(uuid.uuid4())
        
        # Get current timestamp
        current_time = datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        
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
                # Insert user data with creation timestamp
                sql = """
                    INSERT INTO users 
                    (id, username, email, weather_preference, environment_preference, activity_preference, created_at) 
                    VALUES (%s, %s, %s, %s, %s, %s, %s)
                """
                cursor.execute(sql, (
                    user_id,
                    user_data['username'],
                    user_data['email'],
                    user_data['weather'],
                    user_data['environment'],
                    user_data['activity'],
                    current_time
                ))
                
            # Commit changes to database
            connection.commit()
            
            return {
                'statusCode': 200,
                'headers': {
                    'Access-Control-Allow-Origin': '*',
                    'Content-Type': 'application/json'
                },
                'body': json.dumps({
                    'message': 'User registered successfully',
                    'userId': user_id,
                    'createdAt': current_time
                })
            }
        finally:
            connection.close()
            
    except Exception as e:
        print(f"Error saving user data: {str(e)}")
        return {
            'statusCode': 500,
            'headers': {
                'Access-Control-Allow-Origin': '*',
                'Content-Type': 'application/json'
            },
            'body': json.dumps({
                'message': 'Failed to register user',
                'error': str(e)
            })
        }