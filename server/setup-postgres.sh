#!/bin/bash

# PostgreSQL Setup Script for macOS
# This script helps set up PostgreSQL for DAWG backend

set -e

echo "🔧 DAWG PostgreSQL Setup Script"
echo "================================"
echo ""

# Check if PostgreSQL is already installed
if command -v psql &> /dev/null; then
    echo "✅ PostgreSQL is already installed"
    psql --version
    echo ""
else
    echo "❌ PostgreSQL is not installed"
    echo ""
    echo "Please install PostgreSQL using one of these methods:"
    echo ""
    echo "1. Homebrew (Recommended):"
    echo "   /bin/bash -c \"\$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)\""
    echo "   brew install postgresql@14"
    echo "   brew services start postgresql@14"
    echo ""
    echo "2. Postgres.app (GUI):"
    echo "   Download from: https://postgresapp.com/"
    echo "   Install and start from Applications"
    echo ""
    echo "3. Official Installer:"
    echo "   Download from: https://www.postgresql.org/download/macosx/"
    echo ""
    exit 1
fi

# Check if PostgreSQL is running
if pg_isready -h localhost -p 5432 &> /dev/null; then
    echo "✅ PostgreSQL is running"
else
    echo "⚠️  PostgreSQL is not running"
    echo ""
    echo "Please start PostgreSQL:"
    echo "  - If using Homebrew: brew services start postgresql@14"
    echo "  - If using Postgres.app: Start from Applications"
    echo ""
    exit 1
fi

# Check if database exists
if psql -h localhost -U postgres -lqt | cut -d \| -f 1 | grep -qw dawg; then
    echo "✅ Database 'dawg' already exists"
else
    echo "📦 Creating database 'dawg'..."
    
    # Try to create database
    if psql -h localhost -U postgres -c "CREATE DATABASE dawg;" 2>&1; then
        echo "✅ Database 'dawg' created successfully"
    else
        echo "⚠️  Could not create database automatically"
        echo ""
        echo "Please create it manually:"
        echo "  createdb dawg"
        echo ""
        echo "Or if you need to specify user:"
        echo "  psql -U postgres -c 'CREATE DATABASE dawg;'"
        echo ""
    fi
fi

echo ""
echo "✅ Setup complete!"
echo ""
echo "Next steps:"
echo "  1. Update .env file with your PostgreSQL credentials"
echo "  2. Run: npm run migrate"
echo "  3. Run: npm run dev"
echo ""

