#!/bin/bash

# Post-Deployment Configuration
# Run this after deploying the smart contract

echo "🔧 Aptos Ninja - Post-Deployment Configuration"
echo "==============================================="
echo ""

# Check if deployment address is provided
if [ -z "$1" ]; then
    echo "❌ Error: No deployment address provided"
    echo ""
    echo "Usage: ./scripts/post-deploy.sh YOUR_DEPLOYED_ADDRESS"
    echo ""
    echo "Example:"
    echo "  ./scripts/post-deploy.sh 0x1234567890abcdef"
    echo ""
    exit 1
fi

DEPLOYED_ADDR=$1

echo "📍 Deployed Address: $DEPLOYED_ADDR"
echo ""

# Backup original file
echo "📦 Backing up original aptosService.js..."
cp src/services/aptosService.js src/services/aptosService.js.backup
echo "✅ Backup created: src/services/aptosService.js.backup"
echo ""

# Update MODULE_ADDRESS
echo "🔄 Updating MODULE_ADDRESS in aptosService.js..."
sed -i '' "s/this.MODULE_ADDRESS = \"0x1\";/this.MODULE_ADDRESS = \"$DEPLOYED_ADDR\";/" src/services/aptosService.js

# Verify the change
if grep -q "this.MODULE_ADDRESS = \"$DEPLOYED_ADDR\"" src/services/aptosService.js; then
    echo "✅ MODULE_ADDRESS updated successfully!"
else
    echo "❌ Failed to update MODULE_ADDRESS"
    echo "Please manually update src/services/aptosService.js"
    echo "Change line ~15 to: this.MODULE_ADDRESS = \"$DEPLOYED_ADDR\";"
    exit 1
fi

echo ""
echo "✅ Configuration complete!"
echo ""
echo "📋 Next Steps:"
echo "1. Restart your development server (npm start)"
echo "2. Connect your Petra wallet"
echo "3. Play a test game"
echo "4. Verify on explorer:"
echo "   https://explorer.aptoslabs.com/account/${DEPLOYED_ADDR}?network=testnet"
echo ""
echo "🎮 Your game is ready to play!"
echo ""
