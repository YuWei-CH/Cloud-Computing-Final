import os
import json
from openai import OpenAI
from pymemcache.client.base import Client

# 1) Initialize the DeepSeek client and Memcache client once at cold start
deepseek = OpenAI(
    api_key=os.environ['DEEPSEEK_API_KEY'],
    base_url=os.environ['DEEPSEEK_BASE_URL']
)

SYSTEM_PROMPT = """
You are a helpful assistant. When asked, you must return your answer ONLY as a JSON object
with exactly one key:

  "places" — whose value is an array of objects. Each object must have exactly three keys:
    1. name        — the place's name
    2. address     — the full postal address
    3. description — a short description (between 15 and 20 words)

E.g.:
{
  "places": [
    {
      "name": "Eiffel Tower",
      "address": "Champ de Mars, 5 Avenue Anatole France, 75007 Paris, France",
      "description": "Iconic iron tower with panoramic Paris views"
    },
    …
  ]
}

Do not include any extra text, markdown, or explanation—just the JSON object.
"""

CACHE_HOST = os.environ['MEMCACHED_ENDPOINT']
CACHE_PORT = int(os.environ.get('MEMCACHED_PORT', 11211))
cache = Client((CACHE_HOST, CACHE_PORT))

# How long to cache (in seconds)
CACHE_TTL = int(os.environ.get('CACHE_TTL_SECONDS', 3600))

def lambda_handler(event, context):
    # 2) Extract inputs: prefer query string parameters for GET
    qs = event.get('queryStringParameters') or {}
    if qs:
        payload = qs
    else:
        # Fallback to JSON body parsing (POST or proxy)
        body = event.get('body')
        if isinstance(body, str):
            try:
                payload = json.loads(body)
            except json.JSONDecodeError:
                return {
                    "statusCode": 400,
                    "body": json.dumps({"error": "Invalid JSON in body"})
                }
        elif isinstance(body, dict):
            payload = body
        else:
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

    # 4) Build a cache key
    raw_key = f"{city}:{weather}:{environment}:{activity}"
    cache_key = raw_key.replace(" ", "_")

    # 5) Try cache lookup
    cached = cache.get(cache_key)
    if cached:
        print("Cache HIT")
        # cached is bytes; decode to str
        body_str = cached.decode('utf-8')
        return {
            "statusCode": 200,
            "headers": {"Content-Type":"application/json"},
            "body": body_str
        }

    print("Cache MISS")
    
    # 6) Build prompt with JSON‐format instruction
    user_prompt = (
        f"Can you please recommend me 9 places that I should visit in {city}, "
        f"based on these three preferences?\n"
        f"1. Weather: {weather}\n"
        f"2. Environment: {environment}\n"
        f"3. Activity: {activity}\n"
    )

    # 7) Call DeepSeek via the OpenAI‑compatible SDK
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
    
    # 8) Parse the JSON directly
    try:
        data = json.loads(raw)
        places = data.get("places")
        assert isinstance(places, list)
        for item in places:
            assert "name" in item and "address" in item and "description" in item
    except Exception:
        return {
            "statusCode":502,
            "body": json.dumps({
                "error": "Failed to parse DeepSeek response as JSON",
                "raw_response": raw
            })
        }

    # 9) Cache the response body string
    body_str = json.dumps({"places": places})
    cache.set(cache_key, body_str, expire=CACHE_TTL)

    # 10) Return structured result
    return {
        "statusCode": 200,
        "headers": {"Content-Type":"application/json"},
        "body": body_str
    }