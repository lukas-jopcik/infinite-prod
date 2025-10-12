#!/bin/bash

# Run the meta descriptions update locally for testing
# This script runs the Lambda function locally to test the meta description updates

set -e

FUNCTION_DIR="update-meta-descriptions"

echo "🧪 Running meta descriptions update locally..."

# Navigate to the function directory
cd "$FUNCTION_DIR"

# Install dependencies if not already installed
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
fi

# Run the function locally
echo "🚀 Running the update function..."
node index.js

echo "✅ Local test completed!"
