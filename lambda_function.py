import json
from geopy.geocoders import Nominatim
from geopy.distance import geodesic
import folium

def lambda_handler(event, context):
    try:
        # Get locations from the event
        body = json.loads(event.get('body', '{}'))
        start_location = body.get('start', 'New York, NY')
        end_location = body.get('end', 'Los Angeles, CA')
        
        # Initialize geocoder
        geolocator = Nominatim(user_agent="my_routing_app")
        
        # Get coordinates
        start_coords = geolocator.geocode(start_location)
        end_coords = geolocator.geocode(end_location)
        
        if not start_coords or not end_coords:
            return {
                'statusCode': 400,
                'body': json.dumps({'error': 'Could not geocode one or both locations'})
            }
        
        # Calculate distance
        distance = geodesic(
            (start_coords.latitude, start_coords.longitude),
            (end_coords.latitude, end_coords.longitude)
        ).miles
        
        # Create a map
        m = folium.Map(
            location=[(start_coords.latitude + end_coords.latitude)/2,
                     (start_coords.longitude + end_coords.longitude)/2],
            zoom_start=5
        )
        
        # Add markers
        folium.Marker(
            [start_coords.latitude, start_coords.longitude],
            popup='Start: ' + start_location
        ).add_to(m)
        
        folium.Marker(
            [end_coords.latitude, end_coords.longitude],
            popup='End: ' + end_location
        ).add_to(m)
        
        # Draw a line between points
        folium.PolyLine(
            locations=[[start_coords.latitude, start_coords.longitude],
                      [end_coords.latitude, end_coords.longitude]],
            color='red',
            weight=2
        ).add_to(m)
        
        # Save map to a temporary file
        map_path = '/tmp/route_map.html'
        m.save(map_path)
        
        # Read the map file
        with open(map_path, 'r') as f:
            map_html = f.read()
        
        return {
            'statusCode': 200,
            'headers': {
                'Content-Type': 'text/html'
            },
            'body': map_html
        }
        
    except Exception as e:
        return {
            'statusCode': 500,
            'body': json.dumps({'error': str(e)})
        } 