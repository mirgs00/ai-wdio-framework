# AI-Powered WebDriverIO Test Automation Framework

An intelligent test automation framework that uses AI (Ollama) to automatically generate Cucumber Gherkin scenarios, step definitions, and page objects based on DOM analysis and natural language instructions.

## 🎯 What This Framework Does

This framework combines:
- **AI-Powered Test Generation**: Uses local LLM (Ollama) to generate comprehensive test scenarios from natural language
- **WebDriverIO + Cucumber**: Industry-standard BDD testing framework with enhanced auto-generation
- **Automatic DOM Analysis**: Intelligently crawls and analyzes web pages to discover elements and structure
- **Smart Test Artifacts**: Auto-generates feature files, type-safe step definitions, and page object models
- **Mobile Support**: Android and iOS test configurations with element scanning
- **CLI Interface**: Simple command-line interface for test generation and execution
- **Generated Step Definitions**: Automatically creates well-structured step definitions with error handling

## 🏗️ Architecture

```
┌─────────────────┐
│   User Input    │
│  (URL + Prompt) │
└────────┬────────┘
         │
         ▼
┌─────────────────────────────┐
│       CLI Tool              │
│    (src/cli.ts)             │
└────────┬────────────────────┘
         │
    ┌────┴─────┬───────────┬─────────────────┐
    ▼          ▼           ▼                 ▼
┌────────┐ ┌─────────┐ ┌──────────┐ ┌─────────────────┐
│  DOM   │ │   AI    │ │ Scenario │ │  Step Defs      │
│Parser  │ │ Client  │ │ Builder  │ │ Builder         │
└────────┘ └─────────┘ └──────────┘ └─────────────────┘
    │          │           │                 │
    └──────────┴───────────┴─────────────────┘
                    │
                    ▼
          ┌─────────────────────┐
          │  Generated Tests    │
          │  (.feature files)   │
          └─────────────────────┘
                    │
                    ▼
          ┌─────────────────────┐
          │  Run with WebDriver │
          │  Run Tests          │
          └─────────────────────┘
```

## 📦 Key Components

### Core Modules

- **`src/cli.ts`**: Main orchestrator - manages test generation workflow, CLI arguments, and test execution
- **`src/utils/ai/ollamaClient.ts`**: AI interface for communicating with Ollama LLM for scenario and code generation
- **`src/utils/dom/domParser.ts`**: Fetches and intelligently parses DOM structure from URLs
- **`src/utils/dom/discoverElementsFromDOM.ts`**: Element discovery and attribute extraction from DOM
- **`src/utils/test-gen/scenarioBuilder.ts`**: Generates Cucumber Gherkin feature files with BDD scenarios
- **`src/utils/test-gen/stepDefinitionBuilder.ts`**: Auto-generates TypeScript step definitions with error handling
- **`src/utils/test-gen/pageObjectBuilder.ts`**: Builds type-safe page object models with element selectors
- **`src/step-definitions/generatedSteps.ts`**: Auto-generated step implementations with robust error handling
- **`src/page-objects/generatedPage.ts`**: Auto-generated page object with element getter methods
- **`src/utils/mobile/scanMobileApp.ts`**: Scans and catalogs mobile app elements (Android/iOS)

### Configuration

- **`wdio.conf.ts`**: WebDriverIO configuration for web testing
- **`configs/wdio.android.conf.ts`**: Android mobile testing config
- **`configs/wdio.ios.conf.ts`**: iOS mobile testing config

### Generated Artifacts

- **`src/features/*.feature`**: Cucumber Gherkin feature files
- **`src/step-definitions/*.ts`**: Step definition implementations
- **`src/page-objects/*.ts`**: Page Object Model classes

## 🚀 Getting Started

### Prerequisites

1. **Node.js 18+** installed
2. **Ollama** installed and running (for AI functionality)
3. **Chrome browser** (for web testing)
4. **Appium** (for mobile testing, optional)

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd ai-wdio-framework

# Install dependencies and setup Ollama model
npm run setup

# Or manually:
npm install
npm run ollama:pull

# In a separate terminal, start Ollama service
npm run ollama:start
```

**Note**: Ollama must be installed on your system. Visit [https://ollama.com](https://ollama.com) to download.

### Quick Start

#### 1. Generate Tests for a Web Page

```bash
npm run generate
```

Or manually:
```bash
npx ts-node src/cli.ts https://practicetestautomation.com/practice-test-login/ "Test the login page with different types of credentials"
```

This will:
1. Fetch the DOM from the URL
2. Analyze the page structure
3. Generate Cucumber scenarios using AI
4. Create step definitions
5. Build page objects
6. Run the tests automatically

#### 2. Run Existing Tests

```bash
# Run all tests
npm run wdio

# Run specific feature
npx wdio run wdio.conf.ts --spec src/features/sample.feature
```

#### 3. Ollama Management

```bash
# Start Ollama service (run in separate terminal)
npm run ollama:start

# Pull the default AI model
npm run ollama:pull

# Check if Ollama is running
npm run ollama:check

# Full setup (installs dependencies and pulls model)
npm run setup
```

#### 4. Mobile Testing

```bash
# Android testing
npm run android

# iOS testing  
npm run ios

# Scan mobile app elements
npm run scanMobile
```

## 📝 Usage Examples

### Basic Web Test Generation

```bash
# Using npm script (predefined URL)
npm run generate

# Using CLI with custom URL and description
npx ts-node src/cli.ts https://example.com "Test user registration form validation"
```

### Advanced Usage

```bash
# Analyze a specific page and generate comprehensive tests
npx ts-node src/cli.ts https://example.com/login "Test login with valid and invalid credentials, edge cases"

# Test with timeout customization (in milliseconds)
npx ts-node src/cli.ts https://example.com "Test search functionality" --timeout 90000
```

### Generated Artifacts

After running the generator, you'll find:
- **Feature files**: `src/features/*.feature` - Gherkin scenarios
- **Step definitions**: `src/step-definitions/generatedSteps.ts` - Step implementations
- **Page objects**: `src/page-objects/generatedPage.ts` - Element selectors and methods

### Running Generated Tests

```bash
# Run all generated tests
npm run wdio

# Run specific feature
npx wdio run wdio.conf.ts --spec src/features/login.feature

# Run with headless mode disabled (see browser)
npx wdio run wdio.conf.ts --headless=false
```

### Environment Variables

Create a `.env` file in the project root with your configuration:

```env
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=llama3
OLLAMA_TIMEOUT=30000
LOGIN_URL=https://practicetestautomation.com/practice-test-login/
ANDROID_DEVICE=Pixel_7
ANDROID_VERSION=13.0
ANDROID_APP=./apps/MyApp.apk
```

**Note**: Environment variable loading needs to be explicitly initialized at application entry points using `dotenv.config()`.

Environment variables are used in:
- **Generated step definitions**: Reference `LOGIN_URL` and other test-specific variables
- **Page object models**: Dynamic URL construction
- **AI client configuration**: Model selection and API timeouts

## 🎨 Features

### AI-Powered Test Generation
- Intelligent scenario generation based on DOM analysis and NLP
- Automatic happy path and edge case detection
- Smart step definition creation with comprehensive error handling
- Natural language test instructions with parameter extraction
- Environment variable integration for dynamic test data

### Generated Step Definitions
- Automatically generated Gherkin step implementations
- Robust error handling with meaningful error messages
- Parameter extraction from Gherkin scenarios
- Page object integration for element interactions
- Type-safe WebDriver interactions

### Web Automation
- Chrome/Safari/Firefox support with headless mode
- Screenshot capture on test failures
- Automatic waits and retry mechanisms
- Cross-browser testing capabilities
- Reliable element discovery and interaction

### Mobile Automation
- Android (UiAutomator2) and iOS (XCUITest) support
- Intelligent element discovery and scanning
- Gesture support for complex interactions
- App management and lifecycle handling

### Test Reporting & Debugging
- Real-time console output during execution
- Detailed failure messages with error context
- Screenshot artifacts for visual debugging
- CI/CD integration ready
- Test execution tracking

## 📂 Project Structure

```
ai-wdio-framework/
├── src/
│   ├── cli.ts                              # Main CLI entry point & orchestrator
│   ├── features/                           # Cucumber feature files (auto-generated)
│   │   ├── sample.feature
│   │   └── practicetestautomation_*.feature
│   ├── step-definitions/                   # Step definitions (auto-generated & manual)
│   │   ├── generatedSteps.ts              # Auto-generated step implementations
│   │   └── sample.steps.ts
│   ├── page-objects/                       # Page Object Models (auto-generated)
│   │   ├── generatedPage.ts               # Auto-generated page object
│   │   └── sample.page.ts
│   └── utils/
│       ├── ai/
│       │   └── ollamaClient.ts            # Ollama LLM interface
│       ├── dom/
│       │   ├── domParser.ts               # DOM fetching & parsing
│       │   ├── discoverElementsFromDOM.ts # Element discovery
│       │   └── fetchDom.ts
│       ├── mobile/
│       │   └── scanMobileApp.ts           # Mobile app element scanner
│       └── test-gen/
│           ├── scenarioBuilder.ts         # Feature file generator
│           ├── stepDefinitionBuilder.ts   # Step definition generator
│           └── pageObjectBuilder.ts       # Page object generator
├── configs/
│   ├── wdio.android.conf.ts               # Android testing config
│   ├── wdio.ios.conf.ts                   # iOS testing config
│   └── wdio.shared.conf.ts                # Shared configuration
├── apps/
│   └── SauceLabsSample.apk                # Sample Android test app
├── screenshots/                           # Test failure screenshots
├── build/                                 # Compiled JavaScript output
├── wdio.conf.ts                           # Main WebDriverIO config (web)
├── wdio.conf.js                           # Compiled WDIO config
├── tsconfig.json                          # TypeScript configuration
├── package.json                           # Project dependencies & scripts
├── IMPROVEMENTS.md                        # Issues & improvements tracker
├── .env                                   # Environment variables (not in git)
├── .gitignore                             # Git ignore patterns
└── README.md                              # This file
```

## 🔧 Configuration

### WebDriverIO Settings

Edit `wdio.conf.ts` to customize:
- **Browser capabilities**: Chrome, Firefox, Safari options
- **Test timeouts**: Default timeout and action timeouts
- **Reporter settings**: Spec reporter verbosity and output format
- **Hook implementations**: Before/After test hooks for setup/cleanup
- **Services**: Local runner, devtools, mobile services

### AI Model Configuration

Customize in `src/utils/ai/ollamaClient.ts`:
- **Model selection**: Change from default `llama3` to other models (e.g., `llama2`)
- **Temperature**: Controls creativity vs consistency (0.0-1.0)
- **Prompt engineering**: Refine prompts for better test generation
- **Token limits**: Max tokens for AI responses
- **Timeout settings**: HTTP timeout for Ollama API calls

### Mobile Testing Configuration

Edit mobile configs in `configs/`:
- **`wdio.android.conf.ts`**: Android device capabilities, app path, Appium settings
- **`wdio.ios.conf.ts`**: iOS device capabilities, bundle IDs, simulator options

## 🐛 Troubleshooting

### Ollama Connection Issues

```bash
# Check if Ollama is running
curl http://localhost:11434/api/tags

# Restart Ollama service
ollama serve

# Verify model is available
ollama list
```

### WebDriver Issues

```bash
# Check WebDriver version
npx wdio --version
```

### TypeScript Compilation Errors

```bash
# Clean and rebuild
rm -rf build dist
npm run build

# Check for type errors
npx tsc --noEmit
```

### Generated Test Failures

- Ensure environment variables are configured in `.env` (e.g., `LOGIN_URL`)
- Verify page elements match the selectors in generated page objects
- Check browser compatibility with generated element locators
- Review step definition implementations for missing selectors

### Element Not Found Errors

- Run DOM analysis again to re-scan element structure
- Verify application URL is accessible and loads properly
- Check if page elements have changed since test generation

## ⚠️ Known Issues & Improvements

See `IMPROVEMENTS.md` for a comprehensive list of identified issues and improvements. Notable items:

- **Code Quality**: Large commented code blocks in some utilities (ollamaClient.ts, stepDefinitionBuilder.ts)
- **Error Handling**: Inconsistent error handling patterns across the codebase
- **CLI Parsing**: Current argument parsing is fragile with special characters and quotes
- **Page Object Generation**: Potential duplicate getter names when multiple similar elements exist
- **Validation**: Missing URL validation and input sanitization before processing

### Quick Wins for Contributors

- Remove duplicate `toCamelCase` function declaration in `pageObjectBuilder.ts`
- Load `dotenv` config in entry points
- Add URL validation helper function
- Remove large commented code blocks for cleaner codebase

## 📈 Future Enhancements

- [ ] Support for multiple AI providers (OpenAI, Claude, etc.)
- [ ] Visual regression testing capabilities
- [ ] Performance testing integration
- [ ] API testing capabilities
- [ ] Advanced test data management
- [ ] Enhanced reporting and visual dashboards
- [ ] CI/CD pipeline templates
- [ ] Browser extension for test recording
- [ ] Improved error handling and logging framework
- [ ] Code quality and test coverage improvements

## 🤝 Contributing

Contributions are welcome! Please:
1. Review the `IMPROVEMENTS.md` file for identified issues
2. Follow existing code patterns and conventions
3. Test changes with both web and mobile targets
4. Submit pull requests with clear descriptions

## 📄 License

ISC

## 🙏 Acknowledgments

- WebDriverIO team for excellent automation framework
- Cucumber.js community for BDD support
- Ollama for making local LLM accessible
- Sauce Labs for sample mobile testing apps
