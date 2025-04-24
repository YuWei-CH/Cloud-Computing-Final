#!/bin/bash

# Create a temporary directory for our build
mkdir -p build
cd build

# Create Dockerfile
cat > Dockerfile << 'EOF'
FROM public.ecr.aws/lambda/python:3.10

# Install build dependencies
RUN yum install -y gcc python3-devel

# Create and set working directory
WORKDIR /build

# Create the exact AWS Lambda Python path structure
RUN mkdir -p python/lib/python3.10/site-packages

# Copy requirements file
COPY requirements.txt .

# Install all dependencies into the correct site-packages directory
RUN pip install --no-cache-dir -r requirements.txt -t python/lib/python3.10/site-packages/

# Create zip file maintaining the exact structure
RUN cd python && zip -r9 /build/lambda-layer.zip .

# Set permissions
RUN chmod 755 /build/lambda-layer.zip
EOF

# Create requirements.txt
cat > requirements.txt << 'EOF'
numpy==1.26.3
scipy==1.11.4
aiohttp==3.8.5
requests==2.31.0
urllib3==2.0.7
certifi==2023.11.17
charset-normalizer==3.3.2
geopy==2.4.1
folium==0.14.0
Pillow==9.5.0
branca==0.6.0
jinja2==3.1.2
typing_extensions==4.7.1
ortools==9.6.2534
EOF

# Build the Docker image
echo "Building Docker image..."
docker build -t lambda-layer-builder .

# Copy the layer zip from the container
echo "Extracting layer..."
docker create --name temp lambda-layer-builder
docker cp temp:/build/lambda-layer.zip ../lambda-layer.zip
docker rm temp

# Clean up
cd ..
rm -rf build

echo "Lambda layer has been created: lambda-layer.zip"
echo -e "\nFinal layer size:"
size=$(du -sm "lambda-layer.zip" | cut -f1)
echo "lambda-layer.zip: ${size}MB" 