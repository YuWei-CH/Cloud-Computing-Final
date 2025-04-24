#!/bin/bash

# Create directory for the layer
mkdir -p lambda-layer/python

# Install all dependencies into the layer directory using Python 3.9
python3.9 -m pip install -t lambda-layer/python \
    aiohttp==3.8.5 \
    requests==2.31.0 \
    urllib3==2.0.7 \
    certifi==2023.11.17 \
    charset-normalizer==3.3.2 \
    geopy==2.4.1 \
    folium==0.14.0 \
    Pillow==9.5.0 \
    branca==0.6.0 \
    jinja2==3.1.2 \
    numpy==1.24.3 \
    ortools==9.6.2534 \
    scipy==1.10.1 \
    typing_extensions==4.7.1 \

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

# Check size before zipping
echo "Checking layer size..."
if ! check_size "lambda-layer"; then
    echo "Error: Layer exceeds size limit. Please reduce dependencies."
    exit 1
fi

# Create zip file for the layer
echo "Creating zip file..."
cd lambda-layer && zip -r "../lambda-layer.zip" python/ && cd ..

# Clean up
echo "Cleaning up..."
rm -rf lambda-layer/

echo "Lambda layer has been created: lambda-layer.zip"
echo -e "\nFinal layer size:"
size=$(du -sm "lambda-layer.zip" | cut -f1)
echo "lambda-layer.zip: ${size}MB" 