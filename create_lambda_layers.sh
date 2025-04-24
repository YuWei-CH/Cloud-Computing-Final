#!/bin/bash

# Create directories for each layer
mkdir -p routing-core/python
mkdir -p routing-geo/python
mkdir -p routing-viz/python
mkdir -p routing-opt/python
mkdir -p routing-sci/python

# Layer 1: Core dependencies (minimal)
pip install -t routing-core/python \
    aiohttp==3.9.1 \
    requests==2.31.0 \
    urllib3==2.0.7 \
    certifi==2023.11.17 \
    charset-normalizer==3.4.1

# Layer 2: Geocoding (medium size)
pip install -t routing-geo/python \
    geopy==2.4.1

# Layer 3: Visualization (medium size)
pip install -t routing-viz/python \
    folium==0.15.1 \
    Pillow==10.2.0 \
    branca==0.6.0 \
    jinja2==3.1.2

# Layer 4: Route Planning and Optimization (larger size)
pip install -t routing-opt/python \
    numpy==1.26.3 \
    ortools==9.7.2996

# Layer 5: Scientific Computing
pip install -t routing-sci/python \
    scipy==1.11.4

# Function to check directory size
check_size() {
    local dir=$1
    local size=$(du -sm "$dir" | cut -f1)
    if [ "$size" -gt 250 ]; then
        echo "Warning: $dir size ($size MB) exceeds 250MB limit"
        return 1
    fi
    return 0
}

# Check sizes before zipping
echo "Checking layer sizes..."
for layer in routing-*; do
    if ! check_size "$layer"; then
        echo "Error: $layer exceeds size limit. Please reduce dependencies."
        exit 1
    fi
done

# Create zip files for each layer
echo "Creating zip files..."
for layer in routing-*; do
    cd "$layer" && zip -r "../$layer.zip" python/ && cd ..
done

# Clean up
echo "Cleaning up..."
rm -rf routing-*/

echo "Lambda layers have been created:"
echo "routing-core.zip - Core HTTP dependencies"
echo "routing-geo.zip - Geocoding services"
echo "routing-viz.zip - Visualization tools"
echo "routing-opt.zip - Route optimization libraries"
echo "routing-sci.zip - Scientific computing libraries"

# Display final sizes
echo -e "\nFinal layer sizes:"
for zip in routing-*.zip; do
    size=$(du -sm "$zip" | cut -f1)
    echo "$zip: ${size}MB" 