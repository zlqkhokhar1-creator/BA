# Brokerage Trading Platform

Advanced AI-powered brokerage trading platform with institutional-grade performance.

## 🚀 Quick Start

### Prerequisites
- Node.js >= 18.0.0
- npm >= 8.0.0

### Setup
```bash
# Run the setup script
./scripts/setup.sh

# Or manually:
npm install
npm run build
```

### Development
```bash
# Start development servers
npm run dev

# Build for production
npm run build

# Lint code
npm run lint
```

### Verify Installation
```bash
# Check if all dependencies are properly installed
node scripts/verify-install.js
```

## 📁 Project Structure

```
├── apps/
│   └── web-portal/          # Next.js web application
├── packages/                # Shared packages (future)
├── scripts/                 # Setup and utility scripts
├── package.json            # Root workspace configuration
├── turbo.json             # Turbo build configuration
└── tsconfig.json          # Root TypeScript configuration
```

## 🛠️ Technologies

- **Next.js 14** - React framework with App Router
- **TypeScript** - Type-safe JavaScript
- **Tailwind CSS** - Utility-first CSS framework
- **Turbo** - High-performance build system
- **React Query** - Server state management
- **Framer Motion** - Animation library
- **Socket.io** - Real-time communication

## 📦 Available Scripts

- `npm run dev` - Start development servers
- `npm run build` - Build all packages
- `npm run start` - Start production servers
- `npm run lint` - Lint all packages
- `npm run clean` - Clean build artifacts

## 🔧 Configuration

The project uses a monorepo structure with Turbo for build orchestration. Each app and package has its own configuration files.

## 🚨 Troubleshooting

If you encounter build errors:

1. **Missing dependencies**: Run `npm install` in the root directory
2. **TypeScript errors**: Check `tsconfig.json` configurations
3. **Next.js issues**: Verify `next.config.js` settings
4. **Build failures**: Try `npm run clean` followed by `npm run build`

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run tests and linting
5. Submit a pull request