import os
import json
from openai import OpenAI

# 1) Initialize the DeepSeek client once at cold start
deepseek = OpenAI(
    api_key=os.environ['DEEPSEEK_API_KEY'],
    base_url=os.environ['DEEPSEEK_BASE_URL']
)

SYSTEM_PROMPT = """
You are a helpful assistant. When asked, you must return your answer ONLY as a JSON object
with exactly one key:

  "places" — whose value is an array of objects. Each object must have exactly two keys:
    1. name    — the place's name
    2. address — the full postal address

E.g.:
{
  "places": [
    { "name": "Eiffel Tower", "address": "Champ de Mars, 5 Avenue Anatole France, 75007 Paris, France" },
    …
  ]
}

Do not include any extra text, markdown, or explanation—just the JSON object.
"""

def lambda_handler(event, context):
    # 2) Parse incoming JSON (supports both proxy & direct invocation)
    body = event.get('body')
    if isinstance(body, str):
        # API‑GW proxy: body is a JSON string
        try:
            payload = json.loads(body)
        except json.JSONDecodeError:
            return {
                "statusCode": 400,
                "body": json.dumps({"error": "Invalid JSON in body"})
            }
    elif isinstance(body, dict):
        # API‑GW with direct dict body
        payload = body
    else:
        # Direct Lambda test event: event itself is the payload
        payload = event

    city = payload.get('location')
    weather = payload.get('weather')
    environment = payload.get('environment')
    activity = payload.get('activity')

    # 3) Validate required fields
    if not all([city, weather, environment, activity]):
        return {
            "statusCode": 400,
            "body": json.dumps({"error": "Missing one of: location, weather, environment, activity"})
        }

    # 4) Build prompt with JSON‐format instruction
    user_prompt = (
        f"Can you please recommend me 10 places that I should visit in {city}, "
        f"based on these three preferences?\n"
        f"1. Weather: {weather}\n"
        f"2. Environment: {environment}\n"
        f"3. Activity: {activity}\n"
    )

    # 5) Call DeepSeek via the OpenAI‑compatible SDK
    try:
        resp = deepseek.chat.completions.create(
            model="deepseek-chat",
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user",   "content": user_prompt}
            ],
            response_format={"type": "json_object"},
            stream=False
        )
        raw = resp.choices[0].message.content
    except Exception as e:
        return {
            "statusCode": 502,
            "body": json.dumps({"error": f"DeepSeek API error: {e}"})
        }
    
    # 6) Parse the JSON directly
    try:
        data = json.loads(raw)
        places = data.get("places")
        # Optional: validate shape
        assert isinstance(places, list)
        for item in places:
            assert "name" in item and "address" in item
    except Exception:
        return {
            "statusCode":502,
            "body": json.dumps({
                "error": "Failed to parse DeepSeek response as JSON",
                "raw_response": raw
            })
        }

    # 7) Return structured result
    return {
        "statusCode": 200,
        "headers": {"Content-Type":"application/json"},
        "body": json.dumps({"places": places})
    }