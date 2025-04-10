from sqlalchemy import Column, String, Float, Integer, Boolean, DateTime, ForeignKey, Text, JSON
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import uuid
from .db import Base

class OptimizedRoute(Base):
    """Model for storing optimized routes for each day of a trip"""
    __tablename__ = "optimized_routes"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    everyday_id = Column(UUID(as_uuid=True), ForeignKey("everyday.id"), nullable=False)
    total_distance = Column(Float, nullable=False)  # in meters
    total_duration = Column(Float, nullable=False)  # in seconds
    transport_mode = Column(String, nullable=False)  # enum: 'driving', 'walking', 'cycling'
    round_trip = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Relationship
    segments = relationship("RouteSegment", back_populates="route", cascade="all, delete")
    
    def __repr__(self):
        return f"<OptimizedRoute(id={self.id}, everyday_id={self.everyday_id}, transport_mode={self.transport_mode})>"

class RouteSegment(Base):
    """Model for storing individual segments of an optimized route"""
    __tablename__ = "route_segments"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    route_id = Column(UUID(as_uuid=True), ForeignKey("optimized_routes.id"), nullable=False)
    segment_order = Column(Integer, nullable=False)  # order in the route
    start_location_id = Column(UUID(as_uuid=True), ForeignKey("locations.id"), nullable=False)
    end_location_id = Column(UUID(as_uuid=True), ForeignKey("locations.id"), nullable=False)
    distance = Column(Float, nullable=False)  # in meters
    duration = Column(Float, nullable=False)  # in seconds
    coordinates = Column(JSON)  # GeoJSON or array of coordinate points
    
    # Relationships
    route = relationship("OptimizedRoute", back_populates="segments")
    
    def __repr__(self):
        return f"<RouteSegment(id={self.id}, order={self.segment_order}, distance={self.distance})>" 