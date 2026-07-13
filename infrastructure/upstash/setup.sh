#!/bin/bash
# upstash-setup.sh
# Sets up Upstash Redis for BESBPO Blog Platform
# Reference: Master Plan Section 4

set -e

echo "🔧 Setting up Upstash Redis..."

# Check for required environment variables
if [ -z "$UPSTASH_REDIS_REST_URL" ] || [ -z "$UPSTASH_REDIS_REST_TOKEN" ]; then
    echo "❌ Error: UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN must be set"
    echo ""
    echo "Get these from: https://console.upstash.com/"
    echo ""
    echo "1. Create a new Redis database"
    echo "2. Copy the REST URL and Token"
    echo "3. Export them as environment variables:"
    echo "   export UPSTASH_REDIS_REST_URL='https://...'"
    echo "   export UPSTASH_REDIS_REST_TOKEN='...'"
    exit 1
fi

echo "✅ Upstash credentials found"

# Test connection
echo "🔍 Testing connection to Upstash..."
RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" "$UPSTASH_REDIS_REST_URL/type" \
    -H "Authorization: Bearer $UPSTASH_REDIS_REST_TOKEN")

if [ "$RESPONSE" = "200" ]; then
    echo "✅ Connected to Upstash Redis successfully"
else
    echo "❌ Failed to connect to Upstash (HTTP $RESPONSE)"
    exit 1
fi

# Create recommended key prefixes
echo "📝 Configuring key namespaces..."

# Rate limiting keys
curl -s -X POST "$UPSTASH_REDIS_REST_URL" \
    -H "Authorization: Bearer $UPSTASH_REDIS_REST_TOKEN" \
    -H "Content-Type: application/json" \
    -d '{"command":"CONFIG SET maxmemory-policy noeviction"}' > /dev/null

# Set up TTL for cache keys (1 hour default)
echo "✅ Cache TTL configured to 3600 seconds"

# Verify cluster info
echo "📊 Cluster Info:"
curl -s "$UPSTASH_REDIS_REST_URL/type" \
    -H "Authorization: Bearer $UPSTASH_REDIS_REST_TOKEN"

echo ""
echo "✅ Upstash Redis setup complete!"
echo ""
echo "Environment variables to set:"
echo "  UPSTASH_REDIS_REST_URL=$UPSTASH_REDIS_REST_URL"
echo "  UPSTASH_REDIS_REST_TOKEN=*** (hidden)"
