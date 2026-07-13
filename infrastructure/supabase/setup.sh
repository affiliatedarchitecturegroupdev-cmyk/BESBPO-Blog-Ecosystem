#!/bin/bash
# supabase-setup.sh
# Sets up Supabase project for BESBPO Blog Platform
# Reference: Master Plan Section 4, BESBPO-BLOG-ARCH-03

set -e

echo "🔧 Setting up Supabase for BESBPO Blog Platform..."

# Check for required environment variables
if [ -z "$SUPABASE_PROJECT_REF" ]; then
    echo "❌ Error: SUPABASE_PROJECT_REF must be set"
    echo ""
    echo "Get this from: https://supabase.com/dashboard/project/_/settings/api"
    echo "It's the auto-generated project reference (e.g., 'abc123def456')"
    exit 1
fi

if [ -z "$SUPABASE_ACCESS_TOKEN" ]; then
    echo "❌ Error: SUPABASE_ACCESS_TOKEN must be set"
    echo ""
    echo "Get this from: https://supabase.com/dashboard/account/tokens"
    echo "Create a new personal access token"
    exit 1
fi

echo "✅ Supabase credentials found"
echo "Project: $SUPABASE_PROJECT_REF"

# Install Supabase CLI if not present
if ! command -v supabase &> /dev/null; then
    echo "📦 Installing Supabase CLI..."
    npm install -g supabase
fi

echo "🔄 Linking to Supabase project..."
supabase link --project-ref "$SUPABASE_PROJECT_REF"

echo "🔄 Applying migrations..."
supabase db push

echo "🔄 Checking pgvector extension..."
supabase postgres --project-ref "$SUPABASE_PROJECT_REF" -c "SELECT * FROM pg_extension WHERE extname = 'vector';"

echo "✅ Supabase setup complete!"
echo ""
echo "Next steps:"
echo "1. Copy .env.managed.example to .env"
echo "2. Fill in your Supabase credentials"
echo "3. Run: docker-compose -f docker-compose.yml -f docker-compose.managed.yml up"
echo ""
echo "Supabase Dashboard: https://supabase.com/dashboard/project/$SUPABASE_PROJECT_REF"
