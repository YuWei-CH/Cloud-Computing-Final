import os
import json
import pymysql
import boto3
import requests
from datetime import date
from botocore.exceptions import ClientError

# === CONFIG ===
DB_HOST = os.environ["DB_HOST"]
DB_USER = os.environ["DB_USER"]
DB_PASSWORD = os.environ["DB_PASSWORD"]
DB_NAME = os.environ["DB_NAME"]
PLACES_API_KEY = os.environ["GOOGLE_PLACES_API_KEY"]
COVER_BUCKET = "trip-planner-cover-storage"

s3 = boto3.client("s3")

def get_db_connection():
    return pymysql.connect(
        host=DB_HOST,
        user=DB_USER,
        password=DB_PASSWORD,
        database=DB_NAME,
        cursorclass=pymysql.cursors.DictCursor
    )

def check_s3_cover(trip_id):
    try:
        s3.head_object(Bucket=COVER_BUCKET, Key=f"{trip_id}.jpg")
        return f"https://{COVER_BUCKET}.s3.amazonaws.com/{trip_id}.jpg"
    except ClientError as e:
        if e.response["Error"]["Code"] == "404":
            return None
        raise

def fetch_and_store_cover(start_city, trip_id):
    print(f"[DEBUG] Fetching cover for {start_city} (Trip ID: {trip_id})")

    search_url = "https://maps.googleapis.com/maps/api/place/textsearch/json"
    res = requests.get(search_url, params={"query": start_city, "key": PLACES_API_KEY})
    data = res.json()
    print("[DEBUG] Text search result:", data)

    if "results" not in data or not data["results"]:
        print("[WARN] No results found for", start_city)
        return None

    place = data["results"][0]
    if "photos" not in place:
        print("[WARN] No photo found for", start_city)
        return None

    photo_ref = place["photos"][0]["photo_reference"]
    photo_url = "https://maps.googleapis.com/maps/api/place/photo"
    photo_params = {"photoreference": photo_ref, "key": PLACES_API_KEY, "maxwidth": 600}
    image_response = requests.get(photo_url, params=photo_params, stream=True)
    print("[DEBUG] Image fetch status:", image_response.status_code)

    if image_response.status_code != 200:
        return None

    try:
        s3.upload_fileobj(
            image_response.raw,
            COVER_BUCKET,
            f"{trip_id}.jpg",
            ExtraArgs={
                "ContentType": "image/jpeg"
            }
        )
        print(f"[DEBUG] Uploaded image to S3: {trip_id}.jpg")
        return f"https://{COVER_BUCKET}.s3.amazonaws.com/{trip_id}.jpg"
    except ClientError as e:
        print("[ERROR] S3 upload failed:", e)
        return None

def lambda_handler(event, context):
    try:
        print("[DEBUG] Received event:", json.dumps(event))
        
        # Get user identifier from query parameters
        email = event.get("queryStringParameters", {}).get("user_id")
        if not email:
            raise ValueError("Missing user_id in query string")
        
        print(f"[DEBUG] Looking up user with email: {email}")
        
        # Get database connection
        conn = get_db_connection()
        
        # First, get the user's UUID from the users table
        user_uuid = None
        with conn.cursor() as cursor:
            cursor.execute("""
                SELECT id FROM users WHERE email = %s
            """, (email,))
            user_result = cursor.fetchone()
            
            if not user_result:
                print(f"[WARN] No user found with email: {email}")
                return {
                    "statusCode": 404,
                    "headers": {
                        "Access-Control-Allow-Origin": "*"
                    },
                    "body": json.dumps({"error": "User not found", "trips": []})
                }
            
            user_uuid = user_result["id"]
            print(f"[DEBUG] Found user UUID: {user_uuid}")
        
        # Now query trips with the correct user UUID
        with conn.cursor() as cursor:
            cursor.execute("""
                SELECT id, start_city, end_city, duration, status, start_date
                FROM trips WHERE user_id = %s
            """, (user_uuid,))
            trips = cursor.fetchall()
            
        print(f"[DEBUG] Found {len(trips)} trips for user")

        results = []
        for trip in trips:
            trip_id = trip["id"]
            start_city = trip["start_city"]
            trip["title"] = f"Trip to {start_city}"

            cover_url = check_s3_cover(trip_id)
            if not cover_url:
                cover_url = fetch_and_store_cover(start_city, trip_id)

            if cover_url:
                trip["cover_url"] = cover_url

            if isinstance(trip.get("start_date"), date):
                trip["start_date"] = trip["start_date"].isoformat()

            results.append(trip)

        return {
            "statusCode": 200,
            "headers": {
                "Access-Control-Allow-Origin": "*"
            },
            "body": json.dumps({"trips": results})
        }

    except Exception as e:
        print("[ERROR]", str(e))
        return {
            "statusCode": 500,
            "headers": {
                "Access-Control-Allow-Origin": "*"
            },
            "body": json.dumps({"error": str(e)})
        }