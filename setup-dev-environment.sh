#!/bin/bash
# Development Environment Setup Script for Household Management App
# This script installs Node.js v18 LTS, PostgreSQL, and Flutter SDK on Ubuntu 22.04 in WSL

set -e  # Exit on error

echo "=========================================="
echo "Household Management App - Dev Setup"
echo "=========================================="
echo ""

# Update package lists
echo "Step 1: Updating package lists..."
sudo apt update

# Install Node.js v18 LTS
echo ""
echo "Step 2: Installing Node.js v18 LTS..."
if command -v node &> /dev/null; then
    echo "Node.js is already installed: $(node --version)"
else
    curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
    sudo apt install -y nodejs
    echo "Node.js installed: $(node --version)"
    echo "npm installed: $(npm --version)"
fi

# Install PostgreSQL
echo ""
echo "Step 3: Installing PostgreSQL..."
if command -v psql &> /dev/null; then
    echo "PostgreSQL is already installed: $(psql --version)"
else
    sudo apt install -y postgresql postgresql-contrib
    echo "PostgreSQL installed: $(psql --version)"
    
    # Start PostgreSQL service
    sudo service postgresql start
    echo "PostgreSQL service started"
fi

# Install Flutter dependencies
echo ""
echo "Step 4: Installing Flutter dependencies..."
sudo apt install -y curl git unzip xz-utils zip libglu1-mesa

# Install Flutter SDK
echo ""
echo "Step 5: Installing Flutter SDK..."
if command -v flutter &> /dev/null; then
    echo "Flutter is already installed: $(flutter --version | head -n 1)"
else
    cd ~
    
    # Download Flutter
    if [ ! -f "flutter_linux_3.16.0-stable.tar.xz" ]; then
        echo "Downloading Flutter SDK..."
        wget https://storage.googleapis.com/flutter_infra_release/releases/stable/linux/flutter_linux_3.16.0-stable.tar.xz
    fi
    
    # Extract Flutter
    if [ ! -d "flutter" ]; then
        echo "Extracting Flutter SDK..."
        tar xf flutter_linux_3.16.0-stable.tar.xz
    fi
    
    # Add Flutter to PATH in .bashrc if not already there
    if ! grep -q 'flutter/bin' ~/.bashrc; then
        echo 'export PATH="$PATH:$HOME/flutter/bin"' >> ~/.bashrc
        echo "Added Flutter to PATH in ~/.bashrc"
    fi
    
    # Add Flutter to current session PATH
    export PATH="$PATH:$HOME/flutter/bin"
    
    echo "Flutter installed. Running flutter doctor..."
    flutter doctor
fi

echo ""
echo "=========================================="
echo "Installation Complete!"
echo "=========================================="
echo ""
echo "Installed versions:"
echo "  Node.js: $(node --version)"
echo "  npm: $(npm --version)"
echo "  PostgreSQL: $(psql --version | head -n 1)"
echo "  Flutter: $(flutter --version | head -n 1)"
echo "  Git: $(git --version)"
echo ""
echo "Next steps:"
echo "1. Close and reopen your terminal (or run: source ~/.bashrc)"
echo "2. Run 'flutter doctor' to check Flutter setup"
echo "3. Configure PostgreSQL database"
echo "4. Set up project repository structure"
echo ""
