# Development Environment Setup Guide

## ✅ Completed Setup

Task 1 from the Household Management App implementation plan has been completed successfully!

### What Was Installed

1. **WSL2 with Ubuntu 22.04 LTS** - Already installed ✅
2. **Node.js v18.20.8 LTS** - Installed and verified ✅
3. **npm v10.8.2** - Installed with Node.js ✅
4. **PostgreSQL 14.20** - Installed and configured ✅
5. **Flutter SDK 3.16.0** - Installed ✅
6. **Git 2.34.1** - Already installed ✅

### Project Structure Created

```
household-management-app/
├── backend/
│   └── .env.example          # Backend environment variables template
├── mobile/
│   └── .env.example          # Mobile app environment variables template
├── web/
│   └── .env.example          # Web app environment variables template
├── .kiro/
│   └── specs/                # Specification files
├── README.md                 # Project documentation
├── SETUP-GUIDE.md           # This file
├── setup-dev-environment.sh  # Installation script
└── verify-setup.sh          # Verification script
```

### Database Configuration

PostgreSQL has been configured with:
- **Database**: `household_app`
- **User**: `household`
- **Password**: `household123` (⚠️ Change this in production!)
- **Connection**: `postgresql://household:household123@localhost:5432/household_app`

## 🚀 Quick Start Commands

### Starting PostgreSQL

```bash
wsl -d Ubuntu-22.04 -- sudo service postgresql start
```

### Checking PostgreSQL Status

```bash
wsl -d Ubuntu-22.04 -- sudo service postgresql status
```

### Using Node.js

```bash
wsl -d Ubuntu-22.04 -- node --version
wsl -d Ubuntu-22.04 -- npm --version
```

### Using Flutter

Flutter is installed at `~/flutter/bin`. Use it with:

```bash
# Option 1: Full path
wsl -d Ubuntu-22.04 -- ~/flutter/bin/flutter doctor

# Option 2: After reloading shell
wsl -d Ubuntu-22.04 -- bash -c "source ~/.bashrc && flutter doctor"
```

### Verifying Setup

Run the verification script anytime:

```bash
wsl -d Ubuntu-22.04 -- bash /mnt/c/Users/alexl/Home-Tool/verify-setup.sh
```

## 📝 Windows Terminal Configuration (Optional)

For a better development experience, you can configure Windows Terminal:

1. Open Windows Terminal
2. Press `Ctrl + ,` to open settings
3. Add a new profile for Ubuntu 22.04 (if not already present)
4. Set it as default (optional)

### Recommended Terminal Settings

```json
{
    "name": "Ubuntu 22.04 (Dev)",
    "commandline": "wsl.exe -d Ubuntu-22.04",
    "startingDirectory": "//wsl$/Ubuntu-22.04/home/",
    "icon": "ms-appx:///ProfileIcons/{9acb9455-ca41-5af7-950f-6bca1bc9722f}.png",
    "colorScheme": "One Half Dark",
    "fontSize": 11,
    "fontFace": "Cascadia Code"
}
```

## 🔧 Environment Variables

Each project directory has a `.env.example` file. Before starting development:

1. **Backend**:
   ```bash
   cd backend
   cp .env.example .env
   # Edit .env with your actual values
   ```

2. **Mobile**:
   ```bash
   cd mobile
   cp .env.example .env
   # Edit .env with your backend IP address
   ```

3. **Web**:
   ```bash
   cd web
   cp .env.example .env
   # Edit .env with your backend URL
   ```

## 🐛 Troubleshooting

### PostgreSQL Won't Start

```bash
# Check status
wsl -d Ubuntu-22.04 -- sudo service postgresql status

# Start service
wsl -d Ubuntu-22.04 -- sudo service postgresql start

# Restart service
wsl -d Ubuntu-22.04 -- sudo service postgresql restart
```

### Flutter Not Found

Flutter is installed but not in PATH by default. Either:

1. Use full path: `~/flutter/bin/flutter`
2. Reload shell: `source ~/.bashrc`
3. Or add to PATH manually:
   ```bash
   echo 'export PATH="$PATH:$HOME/flutter/bin"' >> ~/.bashrc
   source ~/.bashrc
   ```

### Node.js Version Issues

If you see an older Node.js version:

```bash
# Check version
wsl -d Ubuntu-22.04 -- node --version

# Should show v18.20.8
# If not, the installation script can be re-run
```

### WSL Not Starting

```powershell
# Restart WSL
wsl --shutdown
wsl -d Ubuntu-22.04

# Or restart the specific distribution
wsl --terminate Ubuntu-22.04
wsl -d Ubuntu-22.04
```

## ✅ Validation Checklist

Before proceeding to Task 2, verify:

- [ ] Node.js v18.x is installed
- [ ] npm is working
- [ ] PostgreSQL is installed and running
- [ ] Database `household_app` exists
- [ ] Flutter SDK is installed
- [ ] Git is available
- [ ] Project directories (backend, mobile, web) exist
- [ ] .env.example files are in place

Run `verify-setup.sh` to check all items automatically.

## 📚 Next Steps

Task 1 is complete! You're ready to proceed with:

**Task 2: Initialize backend project structure and core dependencies**
- 2.1 Create Node.js project with TypeScript configuration
- 2.2 Set up PostgreSQL database and connection pooling
- 2.3 Implement basic Express server with health check endpoints

See `.kiro/specs/household-management-app/tasks.md` for the complete implementation plan.

## 📖 Additional Resources

- [Node.js Documentation](https://nodejs.org/docs/latest-v18.x/api/)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/14/)
- [Flutter Documentation](https://docs.flutter.dev/)
- [WSL Documentation](https://docs.microsoft.com/en-us/windows/wsl/)

## 🎯 Requirements Validated

This setup validates the following requirements from the spec:

- **Requirement 14.1**: Complete setup instructions for Windows 11 with WSL ✅
- **Requirement 14.2**: All required dependencies listed and installed ✅
- **Requirement 14.3**: No pre-installed tools assumed (guided installation) ✅

---

**Setup completed on**: March 5, 2026
**Environment**: Windows 11 with WSL2 (Ubuntu 22.04 LTS)
