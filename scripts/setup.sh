#!/bin/bash
echo "🚀 Setting up Brokerage Platform..."

# Check Node.js version
node_version=$(node -v)
echo "Node.js version: $node_version"

# Install root dependencies
echo "📦 Installing root dependencies..."
npm install

# Build packages
echo "🔨 Building packages..."
npm run build

echo "✅ Setup complete!"
echo "🚀 Run 'npm run dev' to start development servers"