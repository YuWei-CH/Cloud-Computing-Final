#!/bin/bash

source venv/bin/activate
echo "Virtual environment activated"

PYTHONPATH=$PYTHONPATH:$(pwd)
echo "set PYTHONPATH to $(pwd)"

/Users/waynewang/Cloud-Computing-Final/setup.sh
echo "use setup.sh to install dependencies and create database"