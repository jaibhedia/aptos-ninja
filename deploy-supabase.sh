#!/bin/bash

# Supabase Deployment Helper Script
# This script helps you deploy the Supabase backend step-by-step

set -e

echo "🚀 Supabase Backend Deployment Helper"
echo "======================================"
echo ""

# Check if Supabase CLI is installed
if ! command -v supabase &> /dev/null; then
    echo "❌ Supabase CLI not found!"
    echo "📦 Installing Supabase CLI..."
    npm install -g supabase
    echo "✅ Supabase CLI installed"
else
    echo "✅ Supabase CLI is installed"
fi

echo ""
echo "Step 1: Login to Supabase"
echo "=========================="
read -p "Press Enter to login (this will open your browser)..."
supabase login

echo ""
echo "Step 2: Link to your Supabase project"
echo "======================================"
echo "Your project ref is in your Supabase URL: https://[project-ref].supabase.co"
read -p "Enter your project ref: " PROJECT_REF

supabase link --project-ref "$PROJECT_REF"
echo "✅ Linked to project: $PROJECT_REF"

echo ""
echo "Step 3: Set Edge Function secrets"
echo "=================================="
echo "You need to set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY"
echo "Get these from: Supabase Dashboard → Settings → API"
echo ""
read -p "Enter your SUPABASE_URL (https://xxxxx.supabase.co): " SUPABASE_URL
read -p "Enter your SUPABASE_SERVICE_ROLE_KEY: " SERVICE_KEY

supabase secrets set SUPABASE_URL="$SUPABASE_URL"
supabase secrets set SUPABASE_SERVICE_ROLE_KEY="$SERVICE_KEY"
echo "✅ Secrets set successfully"

echo ""
echo "Step 4: Deploy Edge Function"
echo "============================"
read -p "Press Enter to deploy the indexer function..."
supabase functions deploy indexer
echo "✅ Edge function deployed"

echo ""
echo "Step 5: Verify deployment"
echo "========================="
supabase functions list
echo ""

echo "✅ Deployment complete!"
echo ""
echo "Next steps:"
echo "1. Go to Supabase Dashboard → SQL Editor"
echo "2. Copy/paste contents of supabase/schema.sql"
echo "3. Click 'Run' to create database tables"
echo "4. Set up cron job (see SUPABASE_SETUP.md)"
echo "5. Update your .env file with Supabase credentials"
echo "6. Restart your React app (npm start)"
echo ""
echo "To manually trigger the indexer:"
echo "curl -X POST \\"
echo "  $SUPABASE_URL/functions/v1/indexer \\"
echo "  -H \"Authorization: Bearer YOUR_ANON_KEY\""
echo ""
echo "📖 See SUPABASE_SETUP.md for detailed instructions"
