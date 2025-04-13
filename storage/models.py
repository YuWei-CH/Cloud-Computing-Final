from sqlalchemy import Column, String, Float, Integer, Boolean, DateTime, ForeignKey, Text, JSON
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import uuid
from .db import Base

class Trip(Base):
    """Model for storing trips"""
    __tablename__ = "trips"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String, nullable=False)
    description = Column(Text)
    start_date = Column(DateTime(timezone=True), nullable=False)
    end_date = Column(DateTime(timezone=True), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Relationships
    days = relationship("Everyday", back_populates="trip", cascade="all, delete")
    
    def __repr__(self):
        return f"<Trip(id={self.id}, name={self.name})>"

class Everyday(Base):
    """Model for storing days of a trip"""
    __tablename__ = "everyday"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    trip_id = Column(UUID(as_uuid=True), ForeignKey("trips.id"), nullable=False)
    day_number = Column(Integer, nullable=False)
    description = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Relationships
    trip = relationship("Trip", back_populates="days")
    locations = relationship("Location", secondary="everyday_locations")
    optimized_route = relationship("OptimizedRoute", uselist=False, back_populates="day")
    
    def __repr__(self):
        return f"<Everyday(id={self.id}, day_number={self.day_number})>"

class Location(Base):
    """Model for storing locations"""
    __tablename__ = "locations"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String, nullable=False)
    address = Column(String, nullable=False)
    latitude = Column(Float)
    longitude = Column(Float)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    def __repr__(self):
        return f"<Location(id={self.id}, name={self.name})>"

class EverydayLocation(Base):
    """Association table for everyday-location many-to-many relationship"""
    __tablename__ = "everyday_locations"
    
    everyday_id = Column(UUID(as_uuid=True), ForeignKey("everyday.id"), primary_key=True)
    location_id = Column(UUID(as_uuid=True), ForeignKey("locations.id"), primary_key=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

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
    
    # Relationships
    segments = relationship("RouteSegment", back_populates="route", cascade="all, delete")
    day = relationship("Everyday", back_populates="optimized_route")
    
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
    start_location = relationship("Location", foreign_keys=[start_location_id])
    end_location = relationship("Location", foreign_keys=[end_location_id])
    
    def __repr__(self):
        return f"<RouteSegment(id={self.id}, order={self.segment_order}, distance={self.distance})>" 