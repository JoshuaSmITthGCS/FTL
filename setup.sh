#!/bin/bash

# Free Textbook Library - Quick Setup Script
# This script helps you set up Firebase in minutes

set -e

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Free Textbook Library - Quick Setup"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Check if Firebase CLI is installed
if ! command -v firebase &> /dev/null; then
    echo "❌ Firebase CLI not found"
    echo ""
    echo "Install it with:"
    echo "  npm install -g firebase-tools"
    echo ""
    exit 1
fi

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js not found"
    echo ""
    echo "Install it from: https://nodejs.org/"
    echo ""
    exit 1
fi

echo "✓ Prerequisites check passed"
echo ""

# Check if service account exists
if [ ! -f "service-account.json" ]; then
    echo "⚠️  service-account.json not found"
    echo ""
    echo "Download it from Firebase Console:"
    echo "  1. Go to https://console.firebase.google.com/"
    echo "  2. Project Settings → Service Accounts"
    echo "  3. Generate new private key"
    echo "  4. Save as service-account.json in this directory"
    echo ""
    read -p "Press Enter when service-account.json is ready..."
    echo ""
fi

if [ ! -f "service-account.json" ]; then
    echo "❌ service-account.json still not found"
    exit 1
fi

echo "✓ service-account.json found"
echo ""

# Login to Firebase
echo "Checking Firebase login..."
if ! firebase login:list &> /dev/null; then
    echo "Please login to Firebase:"
    firebase login
fi

echo "✓ Logged in to Firebase"
echo ""

# Install dependencies
echo "Installing dependencies..."
npm install --silent

echo "✓ Dependencies installed"
echo ""

# Run setup script
echo "Running automated setup..."
echo ""
npm run setup

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  ✅ Automated setup complete!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Next steps:"
echo ""
echo "1. Get Firebase web config:"
echo "   → Firebase Console → Project Settings → Your apps"
echo ""
echo "2. Update js/firebase-config.js with your config"
echo ""
echo "3. Upload to Netlify and test"
echo "   Admin password: Textbook2024"
echo ""
