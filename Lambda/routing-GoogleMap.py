import os
import json
import pymysql
import requests

# === Config ===
API_KEY = os.environ.get("GOOGLE_MAPS_API_KEY")
DB_HOST = os.environ["DB_HOST"]
DB_USER = os.environ["DB_USER"]
DB_PASSWORD = os.environ["DB_PASSWORD"]
DB_NAME = os.environ["DB_NAME"]

def get_db_connection():
    return pymysql.connect(
        host=DB_HOST,
        user=DB_USER,
        password=DB_PASSWORD,
        database=DB_NAME,
        cursorclass=pymysql.cursors.DictCursor
    )

def check_existing_daily_route(conn, trip_id, day_number):
    with conn.cursor() as cursor:
        cursor.execute(
            "SELECT * FROM daily_routes WHERE trip_id = %s AND day_number = %s",
            (trip_id, day_number)
        )
        return cursor.fetchone()

def insert_daily_route(conn, trip_id, day_number, polyline, origin, destination, ordered_places):
    with conn.cursor() as cursor:
        cursor.execute("""
            INSERT INTO daily_routes (trip_id, day_number, polyline, origin, destination, waypoints)
            VALUES (%s, %s, %s, %s, %s, %s)
        """, (
            trip_id,
            day_number,
            polyline,
            origin,
            destination,
            json.dumps(ordered_places)
        ))
    conn.commit()

def get_directions_polyline_optimized(start, places):
    response = requests.get("https://maps.googleapis.com/maps/api/directions/json", params={
        "origin": start,
        "destination": places[-1] if places else start,
        "waypoints": "optimize:true|" + "|".join(places[:-1]) if len(places) > 1 else None,
        "key": API_KEY
    }, timeout=5)

    data = response.json()
    if data["status"] == "OK":
        route = data["routes"][0]
        polyline = route["overview_polyline"]["points"]
        ordered_indexes = route.get("waypoint_order", list(range(len(places) - 1)))
        ordered_places = [places[i] for i in ordered_indexes] + [places[-1]]
        return polyline, ordered_places
    else:
        raise Exception("Google Maps API failed: " + data.get("error_message", data["status"]))

def query_everyday_rows(conn, trip_id):
    with conn.cursor() as cursor:
        cursor.execute("""
            SELECT e.id AS everyday_id, e.day_number, l.name AS start_location_name
            FROM everyday e
            JOIN locations l ON l.address = e.start_location
            WHERE e.trip_id = %s
            ORDER BY e.day_number
        """, (trip_id,))
        return cursor.fetchall()

def query_places_for_day(conn, everyday_id):
    with conn.cursor() as cursor:
        cursor.execute("""
            SELECT l.name
            FROM everyday_locations el
            JOIN locations l ON el.location_id = l.id
            WHERE el.everyday_id = %s
        """, (everyday_id,))
        rows = cursor.fetchall()
        return [r["name"] for r in rows]

# === Lambda Handler ===
def lambda_handler(event, context):
    try:
        print("[DEBUG] Received event:", json.dumps(event))

        trip_id = event.get("queryStringParameters", {}).get("trip_id")
        if not trip_id:
            raise ValueError("Missing trip_id in query string.")

        print(f"[DEBUG] Using trip_id: {trip_id}")

        conn = get_db_connection()
        everyday_rows = query_everyday_rows(conn, trip_id)
        print(f"[DEBUG] Found {len(everyday_rows)} day(s).")

        results = []

        for row in everyday_rows:
            day_number = row["day_number"]
            start = row["start_location_name"]
            places = query_places_for_day(conn, row["everyday_id"])

            if not places:
                print(f"[WARN] No places found for day {day_number}, skipping.")
                continue

            existing = check_existing_daily_route(conn, trip_id, day_number)
            if existing:
                print(f"[DEBUG] Using cached route for day {day_number}")
                results.append({
                    "trip_id": trip_id,
                    "day_number": day_number,
                    "origin": existing["origin"],
                    "destination": existing["destination"],
                    "polyline": existing["polyline"],
                    "waypoints": json.loads(existing["waypoints"]),
                    "source": "db"
                })
                continue

            polyline, ordered_places = get_directions_polyline_optimized(start, places)
            destination = ordered_places[-1] if ordered_places else start
            insert_daily_route(conn, trip_id, day_number, polyline, start, destination, ordered_places)

            results.append({
                "trip_id": trip_id,
                "day_number": day_number,
                "origin": start,
                "destination": destination,
                "polyline": polyline,
                "waypoints": ordered_places,
                "source": "generated"
            })

        return {
            "statusCode": 200,
            "headers": {
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Methods": "GET",
                "Access-Control-Allow-Headers": "Content-Type"
            },
            "body": json.dumps({"results": results})
        }

    except Exception as e:
        print("[ERROR]", str(e))
        return {
            "statusCode": 500,
            "body": json.dumps({"error": str(e)})
        }
