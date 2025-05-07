import os, json, boto3, logging
from datetime import datetime

logger = logging.getLogger()
logger.setLevel(logging.DEBUG)

sqs = boto3.client('sqs')
ses = boto3.client('ses')

QUEUE_URL    = os.environ['QUEUE_URL']
SENDER_EMAIL = os.environ['SENDER_EMAIL']

def handler(event, context):
    logger.debug("=== Flight Emailer start ===")
    count = 0

    while True:
        resp = sqs.receive_message(
            QueueUrl=QUEUE_URL,
            MaxNumberOfMessages=10,
            WaitTimeSeconds=1
        )
        msgs = resp.get('Messages', [])
        if not msgs:
            break

        for m in msgs:
            count += 1
            data    = json.loads(m['Body'])
            name    = data.get('name','Traveler')
            flights = data.get('flights', [])
            email   = data.get('email')

            subject = "✈️ Trip Planner Flight Update"

            html = f"""
            <div style="font-family:Verdana,sans-serif;max-width:600px;margin:auto;
                        border:1px solid #ddd;border-radius:8px;overflow:hidden;
                        box-shadow:0 2px 8px rgba(0,0,0,0.1);">
              <div style="background:#459E95;color:#fff;padding:16px;text-align:center;">
                <img src="https://trip-planner-logos.s3.us-east-2.amazonaws.com/logo1.png"
                     alt="Trip Planner"
                     style="height:40px;vertical-align:middle;margin-right:8px;" />
                <h1 style="
                  display:inline-block;
                  margin:0;
                  font-size:24px;
                  vertical-align:middle;       /* ADDED: aligns text with logo */
                ">Flight Alert</h1>
              </div>
              <div style="padding:20px;color:#333;line-height:1.5;">
                <p>Hi <strong>{name}</strong>,</p>
                <p>Your journey is our top priority—and we want to make sure you’re never caught off‑guard by last‑minute changes. Our real‑time monitoring has detected updates to your upcoming flight itinerary:</p>
                <table style="width:100%;border-collapse:collapse;margin:20px 0;">
                  <thead>
                    <tr style="background:#f0f0f0;">
                      <th style="padding:10px;border:1px solid #ccc;text-align:left;">Flight</th>
                      <th style="padding:10px;border:1px solid #ccc;text-align:left;">Status</th>
                      <th style="padding:10px;border:1px solid #ccc;text-align:left;">New Departure</th>
                    </tr>
                  </thead>
                  <tbody>
            """
            for f in flights:
                status = f['status'].lower()
                if status == 'cancelled':
                    dt = 'TBD'
                else:
                    dt = f['depart_time']

                html += f"""
                    <tr>
                      <td style="padding:10px;border:1px solid #ccc;">{f['ticket']}</td>
                      <td style="padding:10px;border:1px solid #ccc;text-transform:capitalize;">{status}</td>
                      <td style="padding:10px;border:1px solid #ccc;">{dt}</td>
                    </tr>
                """

            html += """
                  </tbody>
                </table>
                <p>We understand how stressful unexpected delays or cancellations can be.  We recommend visiting the airline’s official website for the most up‑to‑the‑minute details—and to explore alternative flight options if needed.</p>
                <p style="text-align:center;margin:30px 0;">
                  <a href="https://aviationstack.com/"
                     style="background:#459E95;color:#fff;padding:12px 24px;text-decoration:none;border-radius:4px;display:inline-block;">
                    Check Live Status
                  </a>
                </p>
                <p>Your peace of mind matters to us. Trip Planner remains committed to guiding you—every step of the way—to a smooth, worry‑free journey. Should you have any questions or need further assistance, don’t hesitate to reach out to our support team.</p>
                <p style="font-size:0.9em;color:#666;">— Warm regards,<br/>The Trip Planner Team</p>
              </div>
            </div>
            """

            ses.send_email(
                Source=SENDER_EMAIL,
                Destination={'ToAddresses':[email]},
                Message={
                    'Subject': {'Data':subject},
                    'Body':    {'Html': {'Data':html}}
                }
            )

            sqs.delete_message(
                QueueUrl=QUEUE_URL,
                ReceiptHandle=m['ReceiptHandle']
            )

    logger.info(f"Sent {count} flight notifications")
    return {'statusCode':200}
