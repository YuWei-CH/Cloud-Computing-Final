import os
import json
import pymysql

# DB config via environment variables
DB_HOST     = os.environ["DB_HOST"]
DB_USER     = os.environ["DB_USER"]
DB_PASSWORD = os.environ["DB_PASSWORD"]
DB_NAME     = os.environ["DB_NAME"]

def lambda_handler(event, context):
    # 1) get ticket_id from the path
    path_params = event.get("pathParameters") or {}
    ticket_id = path_params.get("ticket_id")
    if not ticket_id:
        return {
            "statusCode": 400,
            "headers": {
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*"    # if you need CORS
            },
            "body": json.dumps({"error": "Missing path parameter: ticket_id"})
        }

    # 2) connect to the database
    conn = pymysql.connect(
        host=DB_HOST,
        user=DB_USER,
        password=DB_PASSWORD,
        database=DB_NAME,
        cursorclass=pymysql.cursors.DictCursor
    )

    try:
        with conn.cursor() as cur:
            # 3) attempt the delete
            sql = "DELETE FROM tickets WHERE id = %s"
            rows_deleted = cur.execute(sql, (ticket_id,))
            conn.commit()

        # 4) return appropriate status
        if rows_deleted:
            return {
                "statusCode": 200,
                "headers": {
                    "Content-Type": "application/json",
                    "Access-Control-Allow-Origin": "*"    # if you need CORS
                },
                "body": json.dumps({
                    "message": f"Ticket {ticket_id} deleted successfully"
                })
            }
        else:
            return {
                "statusCode": 404,
                "headers": {
                    "Content-Type": "application/json",
                    "Access-Control-Allow-Origin": "*"    # if you need CORS
                },
                "body": json.dumps({
                    "error": f"No ticket found with id {ticket_id}"
                })
            }

    except Exception as e:
        # 5) on error, log & return 500
        print("Error deleting ticket:", e)
        return {
            "statusCode": 500,
            "headers": {
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*"    # if you need CORS
            },
            "body": json.dumps({
                "error": "Internal server error"
            })
        }

    finally:
        conn.close()