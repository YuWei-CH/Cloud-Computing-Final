from enum import Enum
from typing import Optional
from pydantic import BaseSettings
from dotenv import load_dotenv

load_dotenv()

class Environment(str, Enum):
    LOCAL = "local"
    AWS = "aws"

class Settings(BaseSettings):
    # Environment settings
    ENV: Environment = Environment.LOCAL
    
    # Cache settings
    REDIS_HOST: str = "localhost"
    REDIS_PORT: int = 6379
    REDIS_DB: int = 0
    
    # Routing provider settings
    ROUTING_PROVIDER: str = "osrm"  # Options: "osrm", "aws"
    
    # AWS specific settings (only used when ENV=AWS)
    AWS_REGION: Optional[str] = None
    AWS_ACCESS_KEY_ID: Optional[str] = None
    AWS_SECRET_ACCESS_KEY: Optional[str] = None
    
    # API settings
    API_HOST: str = "0.0.0.0"
    API_PORT: int = 8000
    DEBUG: bool = False
    
    class Config:
        env_file = ".env"

settings = Settings() 