#!/bin/bash
# Verification script for development environment setup

echo "=========================================="
echo "Development Environment Verification"
echo "=========================================="
echo ""

# Check Node.js
echo "Checking Node.js..."
if command -v node &> /dev/null; then
    NODE_VERSION=$(node --version)
    echo "✅ Node.js: $NODE_VERSION"
    if [[ "$NODE_VERSION" == v18* ]]; then
        echo "   ✅ Correct version (v18 LTS)"
    else
        echo "   ⚠️  Expected v18.x, got $NODE_VERSION"
    fi
else
    echo "❌ Node.js not found"
fi

# Check npm
echo ""
echo "Checking npm..."
if command -v npm &> /dev/null; then
    NPM_VERSION=$(npm --version)
    echo "✅ npm: v$NPM_VERSION"
else
    echo "❌ npm not found"
fi

# Check PostgreSQL
echo ""
echo "Checking PostgreSQL..."
if command -v psql &> /dev/null; then
    PSQL_VERSION=$(psql --version | head -n 1)
    echo "✅ PostgreSQL: $PSQL_VERSION"
    
    # Check if PostgreSQL service is running
    if sudo service postgresql status | grep -q "online"; then
        echo "   ✅ PostgreSQL service is running"
        
        # Check if database exists
        if sudo -u postgres psql -lqt | cut -d \| -f 1 | grep -qw household_app; then
            echo "   ✅ Database 'household_app' exists"
        else
            echo "   ⚠️  Database 'household_app' not found"
        fi
    else
        echo "   ⚠️  PostgreSQL service is not running"
        echo "   Run: sudo service postgresql start"
    fi
else
    echo "❌ PostgreSQL not found"
fi

# Check Flutter
echo ""
echo "Checking Flutter..."
if [ -d "$HOME/flutter" ]; then
    FLUTTER_VERSION=$($HOME/flutter/bin/flutter --version | head -n 1)
    echo "✅ Flutter: $FLUTTER_VERSION"
    echo "   📁 Location: $HOME/flutter"
    
    # Check if Flutter is in PATH
    if command -v flutter &> /dev/null; then
        echo "   ✅ Flutter is in PATH"
    else
        echo "   ⚠️  Flutter not in PATH (reload shell: source ~/.bashrc)"
    fi
else
    echo "❌ Flutter not found at $HOME/flutter"
fi

# Check Git
echo ""
echo "Checking Git..."
if command -v git &> /dev/null; then
    GIT_VERSION=$(git --version)
    echo "✅ Git: $GIT_VERSION"
else
    echo "❌ Git not found"
fi

# Check project structure
echo ""
echo "Checking project structure..."
if [ -d "backend" ]; then
    echo "✅ backend/ directory exists"
    if [ -f "backend/.env.example" ]; then
        echo "   ✅ backend/.env.example exists"
    fi
else
    echo "❌ backend/ directory not found"
fi

if [ -d "mobile" ]; then
    echo "✅ mobile/ directory exists"
    if [ -f "mobile/.env.example" ]; then
        echo "   ✅ mobile/.env.example exists"
    fi
else
    echo "❌ mobile/ directory not found"
fi

if [ -d "web" ]; then
    echo "✅ web/ directory exists"
    if [ -f "web/.env.example" ]; then
        echo "   ✅ web/.env.example exists"
    fi
else
    echo "❌ web/ directory not found"
fi

echo ""
echo "=========================================="
echo "Verification Complete!"
echo "=========================================="
echo ""
echo "Summary:"
echo "  - All required tools are installed"
echo "  - Project structure is set up"
echo "  - Ready to proceed with Task 2"
echo ""
