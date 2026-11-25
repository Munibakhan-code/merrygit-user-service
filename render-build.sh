#!/bin/bash
# render-build.sh
echo "🔨 Building application..."

# Install dependencies
npm install --legacy-peer-deps

# Build TypeScript
echo "📦 Compiling TypeScript..."
npx tsc

# Check if build was successful
if [ -f "dist/index.js" ]; then
  echo "✅ Build successful! dist/index.js exists."
  echo "📁 dist/ contents:"
  ls -la dist/
else
  echo "❌ Build failed! dist/index.js not found."
  echo "📁 Current directory contents:"
  ls -la
  echo "📁 src/ contents:"
  ls -la src/
  exit 1
fi