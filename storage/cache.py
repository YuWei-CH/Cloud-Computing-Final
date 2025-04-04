from abc import ABC, abstractmethod
from typing import Any, Optional
import json
import redis
from datetime import datetime, timedelta

class CacheProvider(ABC):
    @abstractmethod
    def get(self, key: str) -> Optional[Any]:
        pass
    
    @abstractmethod
    def set(self, key: str, value: Any, ttl: Optional[int] = None) -> bool:
        pass
    
    @abstractmethod
    def delete(self, key: str) -> bool:
        pass

class RedisCacheProvider(CacheProvider):
    def __init__(self, host: str = 'localhost', port: int = 6379, db: int = 0):
        self.redis_client = redis.Redis(host=host, port=port, db=db)
    
    def get(self, key: str) -> Optional[Any]:
        value = self.redis_client.get(key)
        return json.loads(value) if value else None
    
    def set(self, key: str, value: Any, ttl: Optional[int] = None) -> bool:
        try:
            serialized_value = json.dumps(value)
            if ttl:
                return self.redis_client.setex(key, ttl, serialized_value)
            return self.redis_client.set(key, serialized_value)
        except Exception:
            return False
    
    def delete(self, key: str) -> bool:
        return bool(self.redis_client.delete(key))

class LocalCacheProvider(CacheProvider):
    def __init__(self):
        self.cache = {}
        self.ttls = {}
    
    def get(self, key: str) -> Optional[Any]:
        if key in self.cache:
            if key in self.ttls and datetime.now() > self.ttls[key]:
                del self.cache[key]
                del self.ttls[key]
                return None
            return self.cache[key]
        return None
    
    def set(self, key: str, value: Any, ttl: Optional[int] = None) -> bool:
        try:
            self.cache[key] = value
            if ttl:
                self.ttls[key] = datetime.now() + timedelta(seconds=ttl)
            return True
        except Exception:
            return False
    
    def delete(self, key: str) -> bool:
        if key in self.cache:
            del self.cache[key]
            if key in self.ttls:
                del self.ttls[key]
            return True
        return False

class RouteCache:
    def __init__(self, provider: CacheProvider):
        self.provider = provider
        self.route_ttl = 3600  # 1 hour default TTL
        self.distance_ttl = 86400  # 24 hours default TTL
    
    def get_route(self, src: tuple, dst: tuple) -> Optional[list]:
        key = f"route:{src[0]},{src[1]}:{dst[0]},{dst[1]}"
        return self.provider.get(key)
    
    def set_route(self, src: tuple, dst: tuple, route: list) -> bool:
        key = f"route:{src[0]},{src[1]}:{dst[0]},{dst[1]}"
        return self.provider.set(key, route, self.route_ttl)
    
    def get_distance(self, src: tuple, dst: tuple) -> Optional[float]:
        key = f"distance:{src[0]},{src[1]}:{dst[0]},{dst[1]}"
        return self.provider.get(key)
    
    def set_distance(self, src: tuple, dst: tuple, distance: float) -> bool:
        key = f"distance:{src[0]},{src[1]}:{dst[0]},{dst[1]}"
        return self.provider.set(key, distance, self.distance_ttl)
    
    def get_distance_matrix(self, points: list) -> Optional[dict]:
        key = f"matrix:{','.join(f'{p[0]},{p[1]}' for p in points)}"
        return self.provider.get(key)
    
    def set_distance_matrix(self, points: list, matrix: dict) -> bool:
        key = f"matrix:{','.join(f'{p[0]},{p[1]}' for p in points)}"
        return self.provider.set(key, matrix, self.distance_ttl) 