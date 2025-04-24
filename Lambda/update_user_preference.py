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
    # Handle OPTIONS method for CORS preflight requests
    if event.get('httpMethod') == 'OPTIONS':
        return {
            'statusCode': 200,
            'headers': {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': 'Content-Type,X-User-Email',
                'Access-Control-Allow-Methods': 'OPTIONS,PUT',
                'Access-Control-Max-Age': '86400'
            },
            'body': ''
        }
    
    try:
        # Extract email from X-User-Email header
        if 'headers' not in event or 'X-User-Email' not in event['headers']:
            return {
                'statusCode': 401,
                'headers': {
                    'Access-Control-Allow-Origin': '*',
                    'Content-Type': 'application/json'
                },
                'body': json.dumps({'error': 'Email not provided in request'})
            }
            
        email = event['headers']['X-User-Email']
        
        # Parse request body
        body = json.loads(event['body'])
        weather = body.get('weather')
        environment = body.get('environment')
        activity = body.get('activity')
        
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
                # Update user preferences
                sql = """
                    UPDATE users
                    SET weather_preference = %s, 
                        environment_preference = %s, 
                        activity_preference = %s
                    WHERE email = %s
                """
                cursor.execute(sql, (weather, environment, activity, email))
                
                # Check if any row was affected
                affected_rows = cursor.rowcount
                
                if affected_rows == 0:
                    return {
                        'statusCode': 404,
                        'headers': {
                            'Access-Control-Allow-Origin': '*',
                            'Content-Type': 'application/json'
                        },
                        'body': json.dumps({'error': 'User not found'})
                    }
                
                # Get updated record
                cursor.execute("""
                    SELECT weather_preference, environment_preference, activity_preference 
                    FROM users WHERE email = %s
                """, (email,))
                updated_fields = cursor.fetchone()
                
            # Commit changes to database
            connection.commit()
            
            return {
                'statusCode': 200,
                'headers': {
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Headers': 'Content-Type,X-User-Email',
                    'Content-Type': 'application/json'
                },
                'body': json.dumps({
                    'message': 'Preferences updated successfully',
                    'updatedFields': updated_fields
                })
            }
            
        finally:
            connection.close()
            
    except Exception as e:
        print(f"Error: {str(e)}")
        return {
            'statusCode': 500,
            'headers': {
                'Access-Control-Allow-Origin': '*',
                'Content-Type': 'application/json'
            },
            'body': json.dumps({'error': str(e)})
        }