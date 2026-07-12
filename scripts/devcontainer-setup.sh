#!/bin/bash
# devcontainer-setup.sh
# Sets up development dependencies for all BESBPO services

set -e

echo "🚀 Setting up BESBPO Blog Platform development environment..."

# Install global npm dependencies
echo "📦 Installing global npm dependencies..."
npm install -g pnpm 2>/dev/null || true

# Install Python dependencies for architecture validation
echo "🐍 Installing Python dependencies..."
pip install pyyaml 2>/dev/null || true

# Install Go dependencies for syndication service
echo "🔧 Installing Go dependencies..."
cd /workspace/besbpo-blog-syndication-svc
go mod download 2>/dev/null || echo "⚠️  Go modules need network access"

# Install Rust dependencies for search service
echo "🦀 Fetching Rust dependencies..."
cd /workspace/besbpo-blog-search-media-svc
cargo fetch 2>/dev/null || echo "⚠️  Cargo needs network access"

# Install Java dependencies for enterprise service
echo "☕ Resolving Maven dependencies..."
cd /workspace/besbpo-blog-enterprise-svc
mvn dependency:resolve -q 2>/dev/null || echo "⚠️  Maven needs network access"

# Install Python dependencies for intelligence service
echo "🐍 Installing Python dependencies..."
cd /workspace/besbpo-blog-intelligence-svc
pip install -r requirements.txt -q 2>/dev/null || echo "⚠️  pip needs network access"

# Install Node dependencies for TypeScript services
echo "📦 Installing Node dependencies..."
for repo in besbpo-blog-cms-api besbpo-blog-web besbpo-editorial-dashboard besbpo-embed-widget; do
  cd /workspace/$repo
  npm install 2>/dev/null || echo "⚠️  npm install needs network access for $repo"
done

echo "✅ Development environment setup complete!"
echo ""
echo "Available services:"
echo "  - CMS API: http://localhost:3000"
echo "  - Editorial Dashboard: http://localhost:3001"
echo "  - Blog Web: http://localhost:3002"
echo "  - Intelligence API: http://localhost:8000"
echo "  - Syndication API: http://localhost:8080"
echo "  - Search API: http://localhost:8081"
echo "  - Enterprise API: http://localhost:8082"
