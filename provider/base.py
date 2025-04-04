from abc import ABC, abstractmethod
from typing import List, Tuple, Dict, Optional
from dataclasses import dataclass
from enum import Enum

class TransportMode(Enum):
    """Transportation modes supported by routing providers."""
    DRIVING = "driving"
    WALKING = "walking"
    CYCLING = "cycling"

@dataclass
class RouteSegment:
    """Represents a segment of a route with distance and duration"""
    distance: float  # in meters
    duration: float  # in seconds
    coordinates: List[Tuple[float, float]]  # List of (lat, lng) points
    mode: TransportMode  # Transport mode for this segment

@dataclass
class Route:
    """Represents a complete route between two points"""
    segments: List[RouteSegment]
    total_distance: float
    total_duration: float
    coordinates: List[Tuple[float, float]]

class RoutingProvider(ABC):
    """Abstract base class for routing providers"""
    
    @abstractmethod
    async def get_route(
        self, 
        start: Tuple[float, float], 
        end: Tuple[float, float],
        mode: Optional[TransportMode] = None
    ) -> Route:
        """Get a route between two points"""
        pass
    
    @abstractmethod
    async def get_distance_matrix(
        self, 
        points: List[Tuple[float, float]],
        mode: Optional[TransportMode] = None
    ) -> Dict[Tuple[Tuple[float, float], Tuple[float, float]], float]:
        """Get a matrix of distances between all pairs of points"""
        pass
    
    @abstractmethod
    async def get_duration_matrix(
        self, 
        points: List[Tuple[float, float]],
        mode: Optional[TransportMode] = None
    ) -> Dict[Tuple[Tuple[float, float], Tuple[float, float]], float]:
        """Get a matrix of durations between all pairs of points"""
        pass
    
    @abstractmethod
    async def is_valid_point(
        self, 
        point: Tuple[float, float],
        mode: Optional[TransportMode] = None
    ) -> bool:
        """Check if a point is valid and reachable"""
        pass 