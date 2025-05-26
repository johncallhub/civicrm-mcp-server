#!/bin/bash

# CiviCRM MCP Server Build Script

echo "🔨 Building CiviCRM MCP Server..."

# Navigate to project directory
cd "$(dirname "$0")"

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
fi

# Clean dist directory
echo "🧹 Cleaning build directory..."
rm -rf dist/*

# Build TypeScript
echo "⚙️  Compiling TypeScript..."
npm run build

# Check if build was successful
if [ -f "dist/index.js" ]; then
    echo "✅ Build completed successfully!"
    echo "📋 Server details:"
    echo "   - Main file: dist/index.js"
    echo "   - Tools: 18 CiviCRM tools available"
    echo "   - Features: Enhanced custom field support"
    echo ""
    echo "🚀 To run the server:"
    echo "   CIVICRM_BASE_URL='https://your-civicrm.org' \\"
    echo "   CIVICRM_API_KEY='your-api-key' \\"
    echo "   CIVICRM_SITE_KEY='your-site-key' \\"
    echo "   npm start"
else
    echo "❌ Build failed! Check the error messages above."
    exit 1
fi
