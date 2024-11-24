#!/bin/bash

echo "Starting frontend server at ${FRONTEND_HOST}:${FRONTEND_PORT}"

# Path to your project directory
PROJECT_DIR="/app/"

# NPM command to run (e.g., "start", "run dev", etc.)
NPM_COMMAND="start"

cd $PROJECT_DIR && npm $NPM_COMMAND
