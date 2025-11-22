#!/bin/bash

# Quick Start Script for DAWG Backend
# This script will help you set up and start the backend server

set -e

echo "🚀 DAWG Backend Quick Start"
echo "============================"
echo ""

# Check if PostgreSQL is installed
if command -v psql &> /dev/null; then
    echo "✅ PostgreSQL found"
    psql --version
    echo ""
    
    # Check if PostgreSQL is running
    if pg_isready -h localhost -p 5432 &> /dev/null; then
        echo "✅ PostgreSQL is running"
    else
        echo "⚠️  PostgreSQL is not running"
        echo "Please start PostgreSQL and run this script again"
        exit 1
    fi
    
    # Check if database exists
    if psql -h localhost -lqt 2>/dev/null | cut -d \| -f 1 | grep -qw dawg; then
        echo "✅ Database 'dawg' exists"
    else
        echo "📦 Creating database 'dawg'..."
        createdb dawg 2>&1 || {
            echo "⚠️  Could not create database. Please create it manually:"
            echo "   createdb dawg"
            exit 1
        }
        echo "✅ Database created"
    fi
else
    echo "❌ PostgreSQL is not installed"
    echo ""
    echo "Please install PostgreSQL first:"
    echo "  1. Download Postgres.app from: https://postgresapp.com/"
    echo "  2. Or install via Homebrew: brew install postgresql@14"
    echo ""
    echo "See server/INSTALL_POSTGRES.md for detailed instructions"
    exit 1
fi

echo ""
echo "📦 Running migrations..."
cd "$(dirname "$0")"
npm run migrate

echo ""
echo "🚀 Starting server..."
echo "Server will be available at: http://localhost:3000"
echo ""

npm run dev

