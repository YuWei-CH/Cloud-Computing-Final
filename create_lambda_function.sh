#!/bin/bash

# Create a temporary directory for the function
mkdir -p lambda_package

# Copy the Lambda function
cp lambda_function.py lambda_package/

# Create zip file
cd lambda
zip -r ../lambda_function.zip .
cd ..

# Clean up
rm -rf lambda

echo "Lambda function package created: lambda_function.zip" 