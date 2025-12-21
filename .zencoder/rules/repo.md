---
description: Repository Information Overview
alwaysApply: true
---

# AI-Powered WebDriverIO Test Automation Framework

## Summary
An intelligent test automation framework that leverages AI (Ollama/OpenAI) to automatically generate Cucumber Gherkin scenarios, step definitions, and page objects based on DOM analysis and natural language instructions. It combines WebDriverIO with BDD testing practices, providing both web and mobile (Android/iOS) automation capabilities through a command-line interface.

## Structure
```
src/
├── cli.ts                 # Main entry point for test generation
├── commands/              # Custom WebDriver commands (healableFind)
├── config/                # Configuration management
├── features/              # Generated Cucumber feature files
├── page-objects/          # Generated page object models
├── services/              # Ollama AI service integration
├── step-definitions/      # Generated Cucumber step definitions
├── types/                 # TypeScript type definitions
└── utils/                 # Utility functions
    ├── ai/                # AI client and prompt generation
    ├── cache/             # Caching utilities
    ├── dom/               # DOM parsing and analysis
    ├── healing/           # Element healing and recovery
    ├── locators/          # Locator management
    ├── mobile/            # Mobile app scanning
    ├── test-gen/          # Test generation logic
    ├── logger.ts          # Logging utilities
    └── performanceMonitor.ts
configs/                  # Platform-specific WebDriver configs
├── wdio.android.conf.ts
├── wdio.ios.conf.ts
└── wdio.shared.conf.ts
```

## Language & Runtime
**Language**: TypeScript
**Version**: ^5.9.2
**Target**: ES2020
**Runtime**: Node.js (LTS recommended)
**Build System**: TypeScript compiler (tsc via ts-node)
**Package Manager**: npm

## Dependencies
**Main Dependencies**:
- **webdriverio** (^9.20.0) - WebDriver automation framework
- **@wdio/globals** (^9.0.0) - WebDriver global utilities
- **@wdio/cucumber-framework** (^9.20.0) - Cucumber BDD framework for WDIO
- **openai** (5.10.2) - OpenAI LLM integration
- **axios** (^1.11.0) - HTTP client for API calls
- **cheerio** (^1.1.2) - DOM parsing library
- **dotenv** (^17.2.3) - Environment variable management
- **ts-node** (^10.9.2) - TypeScript execution runtime

**Development Dependencies**:
- **@wdio/cli** (^9.20.0) - WebDriver CLI
- **@wdio/appium-service** (^9.18.4) - Appium mobile automation
- **@wdio/local-runner** (^9.20.0) - Local test runner
- **@wdio/spec-reporter** (^9.20.0) - Test reporter
- **appium** (^2.19.0) - Mobile automation server
- **appium-uiautomator2-driver** (^4.2.8) - Android driver
- **appium-xcuitest-driver** (^9.10.4) - iOS driver
- **@typescript-eslint/eslint-plugin** (^6.0.0) - TypeScript linting
- **eslint** (^8.57.1) - Code quality
- **prettier** (^3.0.0) - Code formatting
- **cucumber** (^6.0.7) - Gherkin support

## Build & Installation

```bash
npm install

npm run setup
npm run lint
npm run format
```

**Generate Tests with OpenAI**:
```bash
npm run generateInstructions
npm run generateAndRun
```

**Generate Tests with Local Ollama**:
```bash
npm run ollama:setup
npm run ollama:start
npm run generateAndRunWithOllama
```

**Run Tests**:
```bash
npm run wdio
npm run android
npm run ios
```

**Mobile App Scanning**:
```bash
npm run scanMobile
```

## Entry Points
- **src/cli.ts** - Main CLI tool for test generation with AI
- **wdio.conf.ts** - Main WebDriver configuration (Chrome/desktop)
- **configs/wdio.android.conf.ts** - Android test configuration
- **configs/wdio.ios.conf.ts** - iOS test configuration

## Testing
**Framework**: Cucumber BDD with WebDriverIO
**Test Location**: src/features/*.feature
**Step Definitions**: src/step-definitions/generatedSteps.ts
**Page Objects**: src/page-objects/generated*.ts
**Naming Convention**: Gherkin feature files for scenarios, auto-generated step implementations
**Configuration**: wdio.conf.ts (main), configs/wdio.*.conf.ts (platform-specific)
**Run Command**:
```bash
npm run wdio
```

## Configuration Files
- **tsconfig.json** - TypeScript compiler configuration (target: ES2020, strict mode enabled)
- **.env** - Environment variables (API keys, endpoints)
- **.eslintrc.json** - ESLint rules for code quality
- **.prettierrc.json** - Prettier formatting rules
- **package.json** - npm scripts and dependencies
