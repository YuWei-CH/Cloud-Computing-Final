cat <<'EOF' > tests/conftest.py
import os

os.environ.setdefault("QUEUE_URL",        "https://dummy-queue")
os.environ.setdefault("SENDER_EMAIL",     "no-reply@dummy")
os.environ.setdefault("DB_HOST",          "dummy-host")
os.environ.setdefault("DB_USER",          "dummy-user")
os.environ.setdefault("DB_PASSWORD",      "dummy-pass")
os.environ.setdefault("DB_NAME",          "dummy-db")
os.environ.setdefault("WEATHER_API_KEY",   "dummy-weather-key")
os.environ.setdefault("FLIGHT_API_KEY",    "dummy-flight-key")
EOF
