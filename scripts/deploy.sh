#!/bin/bash

# Aptos Ninja Smart Contract Deployment Script
# This script deploys the game_nft module to Aptos testnet

set -e

echo "Aptos Ninja Smart Contract Deployment"
echo "========================================"
echo ""

# Check if Aptos CLI is installed
if ! command -v aptos &> /dev/null; then
    echo "❌ Aptos CLI is not installed"
    echo "Please install it from: https://aptos.dev/tools/aptos-cli/"
    exit 1
fi

echo "✅ Aptos CLI found"
echo ""

# Initialize account if needed
echo "Setting up deployment account..."
echo "Please make sure you have a profile configured in ~/.aptos/config.yaml"
echo ""

read -p "Enter your Aptos profile name (default: default): " PROFILE
PROFILE=${PROFILE:-default}

echo ""
echo "Checking account balance..."
aptos account list --profile $PROFILE --account $PROFILE

echo ""
read -p "Do you need testnet tokens? (y/n): " NEED_TOKENS
if [ "$NEED_TOKENS" = "y" ]; then
    echo "Funding account with testnet tokens..."
    aptos account fund-with-faucet --profile $PROFILE --account $PROFILE
    echo "✅Account funded"
fi

echo ""
echo "Compiling Move modules..."
cd move
aptos move compile --named-addresses aptos_ninja=$PROFILE

echo ""
echo "Deploying to Aptos testnet..."
aptos move publish \
    --named-addresses aptos_ninja=$PROFILE \
    --profile $PROFILE \
    --assume-yes

cd ..

echo ""
echo "✅ Deployment successful!"
echo ""

# Get the deployed address
DEPLOYED_ADDRESS=$(aptos config show-profiles --profile $PROFILE | grep "account" | awk '{print $2}')
echo "Module deployed at: $DEPLOYED_ADDRESS"
echo ""

# Initialize the game module
echo "Initializing game module..."
aptos move run \
    --function-id ${DEPLOYED_ADDRESS}::game_nft::initialize \
    --profile $PROFILE \
    --assume-yes

echo ""
echo "Creating NFT collection..."
aptos move run \
    --function-id ${DEPLOYED_ADDRESS}::game_nft::create_collection \
    --profile $PROFILE \
    --assume-yes

echo ""
echo "✅ Setup complete!"
echo ""
echo "Next steps:"
echo "1. Update src/services/aptosService.js"
echo "2. Replace MODULE_ADDRESS with: $DEPLOYED_ADDRESS"
echo "3. Deploy your frontend"
echo ""
echo "🔗 View on Explorer:"
echo "https://explorer.aptoslabs.com/account/${DEPLOYED_ADDRESS}?network=testnet"
echo ""
