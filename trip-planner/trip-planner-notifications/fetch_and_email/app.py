import os
import json
import boto3
from datetime import datetime
import logging

logger = logging.getLogger()
logger.setLevel(logging.DEBUG)

sqs = boto3.client('sqs')
ses = boto3.client('ses')

QUEUE_URL = os.environ['QUEUE_URL']
SENDER_EMAIL = os.environ['SENDER_EMAIL']

def handler(event, context):
    logger.debug("Email handler start")
    total_processed = 0

    while True:
        resp = sqs.receive_message(
            QueueUrl=QUEUE_URL,
            MaxNumberOfMessages=5,
            WaitTimeSeconds=1
        )
        msgs = resp.get('Messages', [])
        logger.debug("Polled SQS → got %d messages", len(msgs))
        if not msgs:
            break

        for m in msgs:
            total_processed += 1
            logger.debug("Msg #%d body: %s", total_processed, m['Body'])
            data = json.loads(m['Body'])

            start_city = data.get('start_city')
            end_city = data.get('end_city')
            abnormal = data.get('abnormal', {})
            logger.debug("Parsed msg: start=%s, end=%s, abnormal=%s",
                         start_city, end_city, json.dumps(abnormal))

            subject = f"🚨 Trip Planner Alert: {start_city} → {end_city}"
            html_parts = [
                "<div style='font-family:Arial,sans-serif;max-width:600px;margin:auto;'>",
                "<h2 style='color:#1A73E8;'>🌍 Trip Planner Alert</h2>",
                f"<p>Hi there,</p>",
                f"<p>We detected issues on your trip from <strong>{start_city}</strong> to <strong>{end_city}</strong>:</p>"
            ]

            # ✅ Reformat weather section with daily summary & rain %
            we = abnormal.get('weather', [])
            logger.debug("Weather alerts count: %d", len(we))
            if we:
                html_parts.append("<h3>🌦️ Weather Issues</h3>")
                html_parts.append(
                    "<table style='border-collapse:collapse;width:100%;'>"
                    "<tr style='background:#f2f2f2;'>"
                    "<th style='border:1px solid #ddd;padding:8px;'>Date</th>"
                    "<th style='border:1px solid #ddd;padding:8px;'>Condition</th>"
                    "</tr>"
                )

                # ✅ Group by date, compute max rain %
                daily = {}
                for w in we:
                    day = w['date']
                    cond = w['condition']
                    pop = w.get('pop', 0)
                    if day not in daily:
                        daily[day] = {'condition': cond, 'pop_list': [pop]}
                    else:
                        daily[day]['pop_list'].append(pop)

                for date, info in sorted(daily.items()):
                    icon = {
                        'Rain': '☔', 'Thunderstorm': '⛈️', 'Snow': '❄️'
                    }.get(info['condition'], '')
                    max_pop = round(max(info['pop_list']) * 100)
                    html_parts.append(
                        f"<tr>"
                        f"<td style='border:1px solid #ddd;padding:8px;'>{date}</td>"
                        f"<td style='border:1px solid #ddd;padding:8px;'>{icon} {info['condition']} ({max_pop}%)</td>"
                        f"</tr>"
                    )

                html_parts.append("</table>")

            # ✈️ Flight issues section
            fl = abnormal.get('flight', [])
            logger.debug("Flight alerts count: %d", len(fl))
            if fl:
                html_parts.append("<h3>✈️ Flight Issues</h3>")
                html_parts.append(
                    "<table style='border-collapse:collapse;width:100%;'>"
                    "<tr style='background:#f2f2f2;'>"
                    "<th style='border:1px solid #ddd;padding:8px;'>Flight</th>"
                    "<th style='border:1px solid #ddd;padding:8px;'>Date</th>"
                    "<th style='border:1px solid #ddd;padding:8px;'>Status</th>"
                    "</tr>"
                )
                for f in fl:
                    html_parts.append(
                        f"<tr>"
                        f"<td style='border:1px solid #ddd;padding:8px;'>{f['number']}</td>"
                        f"<td style='border:1px solid #ddd;padding:8px;'>{f['date']}</td>"
                        f"<td style='border:1px solid #ddd;padding:8px;'>{f['status'].capitalize()}</td>"
                        f"</tr>"
                    )
                html_parts.append("</table>")

            html_parts.append(
                "<p>Stay safe and enjoy your journey!<br/>"
                "<strong>— Trip Planner Team</strong></p></div>"
            )

            full_html = "\n".join(html_parts)
            logger.debug("Final HTML payload:\n%s", full_html)

            try:
                logger.info("Sending email to %s with subject %s", data['email'], subject)
                ses.send_email(
                    Source=SENDER_EMAIL,
                    Destination={'ToAddresses': [data['email']]},
                    Message={
                        'Subject': {'Data': subject},
                        'Body':    {'Html': {'Data': full_html}}
                    }
                )
            except Exception as e:
                logger.error("Failed to send email: %s", e)
                continue

            logger.debug("Deleting message from queue: %s", m['ReceiptHandle'])
            sqs.delete_message(
                QueueUrl=QUEUE_URL,
                ReceiptHandle=m['ReceiptHandle']
            )

    logger.info("Email handler complete: processed %d messages", total_processed)
    return {'statusCode': 200}
