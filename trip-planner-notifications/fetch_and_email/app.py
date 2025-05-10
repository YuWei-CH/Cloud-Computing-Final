import os
import json
import boto3
import logging
from datetime import datetime

logger = logging.getLogger()
logger.setLevel(logging.DEBUG)

sqs          = boto3.client('sqs')
ses          = boto3.client('ses')
QUEUE_URL    = os.environ['QUEUE_URL']
SENDER_EMAIL = os.environ['SENDER_EMAIL']
ICON_BASE    = "https://trip-planner-logos.s3.us-east-2.amazonaws.com/weather/icons/"

# 100-word adventurous greeting
GREETING = (
    "As you prepare for your journey, we understand how important it is to know what Mother Nature "
    "has planned. That’s why our Trip Planner team has prepared a comprehensive, personalized "
    "weather greeting just for you. Think of this as your friendly companion, guiding you through "
    "sunshine, clouds, or raindrops—with tips on attire, activities, and even indoor escapes. "
    "Whether you’re chasing sunrise on the beach, cozying up at a café, or exploring a museum, "
    "our report will help you pack smart and seize every moment. Enjoy the journey and let the "
    "forecast lead the way!"
)

def handler(event, context):
    logger.debug("=== Weather Emailer start ===")
    count = 0
    while True:
        resp = sqs.receive_message(QueueUrl=QUEUE_URL, MaxNumberOfMessages=5, WaitTimeSeconds=1)
        msgs = resp.get('Messages', [])
        if not msgs:
            break
        for m in msgs:
            count += 1
            data        = json.loads(m['Body'])
            name        = data.get('name', 'Traveler')
            start_city  = data['start_city']
            destination = data['destination']
            weather     = data.get('weather', [])
            email       = data['email']

            subject = f"☀️ Trip Planner Weather Report: {start_city} → {destination}"

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
                  vertical-align:middle;
                ">Weather Report</h1>
              </div>
              <div style="padding:20px;color:#333;line-height:1.5;">
                <p>Hi <strong>{name}</strong>,</p>
                <p>{GREETING}</p>
                <p>Here’s the {len(weather)}-day forecast for your trip from <strong>{start_city}</strong> to <strong>{destination}</strong>:</p>
                <table style="width:100%;border-collapse:collapse;margin:20px 0;">
                  <thead>
                    <tr style="background:#f0f0f0;">
                      <th style="padding:10px;border:1px solid #ccc;text-align:left;">Date</th>
                      <th style="padding:10px;border:1px solid #ccc;text-align:left;">Condition</th>
                      <th style="padding:10px;border:1px solid #ccc;text-align:left;">Temp (°C)</th>
                      <th style="padding:10px;border:1px solid #ccc;text-align:left;">Precip (%)</th>
                      <th style="padding:10px;border:1px solid #ccc;text-align:left;">Humidity (%)</th>
                      <th style="padding:10px;border:1px solid #ccc;text-align:left;">Wind (m/s)</th>
                      <th style="padding:10px;border:1px solid #ccc;text-align:left;">Recommendation</th>
                    </tr>
                  </thead>
                  <tbody>
            """
            for w in weather:
                ico = ICON_BASE + w['condition'].lower() + ".png"
                precip = w.get('precipitation', 0)  # fallback if missing
                html += f"""
                    <tr>
                      <td style="padding:10px;border:1px solid #ccc;">{w['date']}</td>
                      <td style="padding:10px;border:1px solid #ccc;">
                        <img src="{ico}" alt="{w['condition']}" style="height:24px;vertical-align:middle;margin-right:4px;"/>
                        {w['condition']}
                      </td>
                      <td style="padding:10px;border:1px solid #ccc;">{w['temp_min']}–{w['temp_max']}</td>
                      <td style="padding:10px;border:1px solid #ccc;">{precip}%</td>
                      <td style="padding:10px;border:1px solid #ccc;">{w['humidity']}</td>
                      <td style="padding:10px;border:1px solid #ccc;">{w['wind']}</td>
                      <td style="padding:10px;border:1px solid #ccc;">{w['recommendation']}</td>
                    </tr>
                """
            html += """
                  </tbody>
                </table>
                <p style="font-size:0.9em;color:#666;">— Warm regards,<br/>The Trip Planner Team</p>
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
            sqs.delete_message(QueueUrl=QUEUE_URL, ReceiptHandle=m['ReceiptHandle'])
        logger.info(f"Sent {count} weather emails")

    return {'statusCode': 200}
    