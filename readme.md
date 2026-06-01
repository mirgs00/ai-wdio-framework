# AI-Powered WebDriverIO Test Automation Framework

An intelligent test automation framework that uses AI (Ollama) to automatically generate Cucumber Gherkin scenarios, step definitions, and page objects. Just provide a URL — or a URL with natural language guidance — and AI analyzes the page, understands the business context, and generates comprehensive end-to-end tests.

## 🎯 What This Framework Does

This framework combines:
- **AI-Powered Test Generation**: Uses local LLM (Ollama) to generate comprehensive test scenarios — either from a URL alone (auto-detect) or with natural language guidance
- **WebDriverIO + Cucumber**: Industry-standard BDD testing framework with enhanced auto-generation
- **Automatic DOM Analysis**: Intelligently crawls and analyzes web pages to discover elements and structure
- **Smart Test Artifacts**: Auto-generates feature files, type-safe step definitions, and page object models
- **Self-Healing Pipeline**: Detects broken selectors at runtime and automatically regenerates page objects
- **Mobile Support**: Android and iOS test configurations with element scanning
- **CLI Interface**: Simple command-line interface for test generation and execution

## 🏗️ Architecture

```
┌────────────────────────────────────┐
│          User Input                │
│     (URL + Prompt / JSON File)     │
└────────┬───────────┬───────────────┘
         │           │
         ▼           ▼
┌─────────────────────────────────────────────────────┐
│             CLI Tool (src/cli.ts)                   │
│  ┌───────────────────────────────────────────────┐  │
│  │          Configuration Layer                  │  │
│  │   config/index.ts  ◄──  constants.ts          │  │
│  └───────────────────────────────────────────────┘  │
└────────┬──────────────────────┬──────────────────────┘
         │                      │
         ▼                      ▼
┌──────────────────┐   ┌──────────────────────────────┐
│  Service Layer   │   │   Healing Pipeline            │
│                  │   │                                │
│ TestGeneration   │   │  HealingWorkflow               │
│ Service          │   │   ├── preExecutionValidation   │
│                  │   │   ├── failureDetectionAnd      │
│ TestRunnerService│   │   │   Recovery                 │
│                  │   │   └── generateReport           │
│ Selector         │   │                                │
│ ValidationService│   │  HealingService                │
└────────┬─────────┘   │   ├── healBrokenSelector       │
         │             │   ├── healBrokenStep           │
         ▼             │   ├── updatePageObject         │
┌──────────────────┐   │   └── regenerateStep           │
│  DOM Pipeline    │   │                                │
│                  │   │  SelfHealingLocator            │
│ domParser.ts     │   │  smartLocator.ts               │
│ domAnalyzer.ts   │   │  selectorValidator.ts          │
│ domCache.ts      │   └──────────────────────────────┘
└────────┬─────────┘
         │
         ▼
┌─────────────────────────────────────────────────────┐
│              AI Layer                                │
│  ┌────────────────┐  ┌────────────────────────────┐  │
│  │  LLMProvider    │  │  Prompt Templates           │  │
│  │  interface      │  │  promptTemplates.ts         │  │
│  │  (types.ts)     │  │                             │  │
│  │                  │  │  scenarioClassifier.ts      │  │
│  │  OllamaClient   │  │  instructionParser.ts       │  │
│  │  ──── implements│  └────────────────────────────┘  │
│  └────────────────┘                                    │
└────────┬────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────┐
│           Test Artifact Generation                   │
│                                                      │
│  scenarioBuilder.ts  ──►  .feature files            │
│  stepDefinitionBuilder.ts  ──►  generatedSteps.ts   │
│  pageObjectBuilder.ts  ──►  generatedPage.ts        │
└────────┬────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────┐
│           Execution with WebDriver + Healing         │
│                                                      │
│  healingHooks.ts  ◄──  wdio.conf.ts  ◄──  run       │
│       │                                              │
│       └── on failure ──► autoRegenerateOnFailure.ts │
└─────────────────────────────────────────────────────┘
```

## 📦 Key Components

### Core Modules

- **`src/cli.ts`**: Main orchestrator — manages test generation workflow, CLI arguments, and test execution
- **`src/config/index.ts`**: Centralized configuration from environment variables with defaults
- **`src/utils/constants.ts`**: Tunable constants for cache, healing, AI timeouts, and DOM processing
- **`src/utils/ai/types.ts`**: `LLMProvider` interface for pluggable AI backends (Ollama, OpenAI, etc.)
- **`src/utils/ai/ollamaClient.ts`**: Ollama LLM client implementing `LLMProvider` for text generation
- **`src/utils/ai/LLMClient.ts`**: High-level AI client that accepts any `LLMProvider`
- **`src/utils/ai/promptTemplates.ts`**: Prompt template management and `PromptTemplateManager`
- **`src/utils/dom/domParser.ts`**: Fetches and parses DOM structure from URLs
- **`src/utils/dom/domAnalyzer.ts`**: Analyzes DOM to extract forms, inputs, buttons, links, and headings. Includes `analyzeDOMWithCache` for memoized analysis
- **`src/utils/dom/domCache.ts`**: Filesystem and in-memory DOM caching with TTL and size limits
- **`src/utils/dom/discoverElementsFromDOM.ts`**: Element discovery and attribute extraction
- **`src/utils/test-gen/scenarioBuilder.ts`**: Generates Cucumber Gherkin feature files with BDD scenarios
- **`src/utils/test-gen/stepDefinitionBuilder.ts`**: Auto-generates TypeScript step definitions with error handling
- **`src/utils/test-gen/pageObjectBuilder.ts`**: Builds type-safe page object models with element selectors
- **`src/utils/test-gen/instructionParser.ts`**: Parses structured instruction files and generates artifacts
- **`src/utils/test-gen/scenarioClassifier.ts`**: Classifies page complexity and suggests scenario types
- **`src/utils/healing/healingWorkflow.ts`**: Orchestrates pre-execution validation, failure recovery, and reporting
- **`src/utils/healing/healingService.ts`**: Selector validation, healing, and page object updates
- **`src/utils/healing/autoRegenerateOnFailure.ts`**: Auto-regenerates DOM and page objects when tests fail
- **`src/utils/healing/healingHooks.ts`**: WebDriverIO hooks that trigger the healing pipeline on failures
- **`src/utils/healing/selectorValidator.ts`**: Validates CSS/XPath selectors against live DOM
- **`src/utils/healing/selectorHelper.ts`**: Alternative selector generation utility
- **`src/utils/locators/smartLocator.ts`**: Multi-strategy locator with fallback chain
- **`src/utils/cache/resultCache.ts`**: Generic in-memory result cache with configurable size
- **`src/utils/file-parser/index.ts`**: Parses `.json`, `.csv`, `.xlsx`, `.docx` instruction files into the internal `Instructions` format
- **`src/utils/file-parser/csvParser.ts`**: Reads CSV with `#` comment metadata and pipe-delimited steps
- **`src/utils/file-parser/excelParser.ts`**: Reads `.xlsx` with "Project" and "Test Cases" sheets
- **`src/utils/file-parser/docxParser.ts`**: Reads `.docx` tables (key-value project info + test case rows)
- **`src/utils/validation.ts`**: `InputValidator` with URL, prompt, shell, timeout, and instruction validation
- **`src/utils/validation/codeValidator.ts`**: Basic TypeScript syntax validation (brace/quote balancing)
- **`src/utils/errorHandler.ts`**: Centralized error handling with typed `AppError`
- **`src/utils/errors.ts`**: Error hierarchy (`AiFrameworkError`, `URLError`, `ValidationError`, etc.)
- **`src/utils/logger.ts`**: Structured logging with batched async file output and performance metrics
- **`src/utils/performanceMonitor.ts`**: Execution timing and metric collection
- **`src/utils/mobile/scanMobileApp.ts`**: Scans and catalogs mobile app elements (Android/iOS)
- **`src/services/TestGenerationService.ts`**: Service layer for test artifact generation
- **`src/services/TestRunnerService.ts`**: Service layer for test execution with healing integration
- **`src/services/SelectorValidationService.ts`**: Pre-flight selector validation service
- **`src/commands/healableFind.ts`**: Custom WebDriver command with automatic healing on element not found
- **`src/step-definitions/generatedSteps.ts`**: Auto-generated step implementations with robust error handling
- **`src/page-objects/generatedPage.ts`**: Auto-generated page object with element getter methods

### Configuration

- **`src/utils/constants.ts`**: Central defaults — `OLLAMA_CONFIG`, `CACHE_CONFIG`, `HEALING_CONFIG`, `TIMEOUTS`, `RETRY_CONFIG`, `DOM_CONFIG`
- **`src/config/index.ts`**: Environment variable loading (`OLLAMA_BASE_URL`, `OLLAMA_MODEL`, `LOG_LEVEL`, `HEADLESS`, etc.)
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
# Auto-detect mode (no instruction needed)
npx ts-node src/cli.ts https://example.com

# Guided mode (URL + natural language guidance)
npx ts-node src/cli.ts https://example.com "Test the login page with different types of credentials"
```

This will:
1. Fetch the DOM from the URL
2. Analyze the page structure and auto-detect business flows
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
# URL only — AI auto-detects business flows and generates tests
npm run auto-generate

# URL + instruction — AI uses your guidance alongside page analysis
npx ts-node src/cli.ts https://example.com "Test user registration form validation"

# URL only via CLI
npx ts-node src/cli.ts https://example.com
```

### Instructions File (CSV / Excel / Word / JSON)

Write test cases in a spreadsheet or document instead of JSON:

```bash
# CSV (plain text, open in any spreadsheet app)
npx ts-node src/cli.ts --instructions test-cases.csv

# Excel (.xlsx)
npx ts-node src/cli.ts --instructions test-cases.xlsx

# Word (.docx)
npx ts-node src/cli.ts --instructions test-cases.docx

# JSON (original format)
npx ts-node src/cli.ts --instructions instructions.json
```

Template files are provided in the project root (`instructions-template.csv`, `.xlsx`, `.docx`).

**Format rules:**
- Steps are pipe-delimited (`|`) in a single cell
- Tags are comma-delimited
- Project metadata (projectName, url, description) is set via `#` comment lines in CSV, or a "Project" sheet/table in Excel/Word

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
# Ollama AI
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=llama3
OLLAMA_TIMEOUT=30000
OLLAMA_MAX_RETRIES=3
OLLAMA_RETRY_DELAY_MS=1000
OLLAMA_DISABLE=false

# Browser & UI
HEADLESS=true
BROWSER=chrome
LOGIN_URL=https://practicetestautomation.com/practice-test-login/

# Logging
LOG_LEVEL=info

# Mobile (Android)
ANDROID_DEVICE=Pixel_7
ANDROID_VERSION=13.0
ANDROID_APP=./apps/MyApp.apk
```

Environment variables are used in:
- **`src/config/index.ts`**: Central configuration loader — reads all OLLAMA_*, HEADLESS, BROWSER, LOG_LEVEL
- **`src/utils/constants.ts`**: Default values that can be overridden via env vars
- **Generated step definitions**: Reference `LOGIN_URL` and other test-specific variables
- **Page object models**: Dynamic URL construction

## 🎨 Features

### AI-Powered Test Generation
- Intelligent scenario generation based on DOM analysis and NLP
- Automatic happy path and edge case detection
- Smart step definition creation with comprehensive error handling
- Natural language test instructions with parameter extraction
- Environment variable integration for dynamic test data
- Pluggable LLM provider interface (Ollama built-in, extensible to OpenAI/Claude)

### Self-Healing Pipeline
- Pre-execution selector validation across all page objects
- Automatic failure detection and recovery via DOM re-scanning
- Multi-strategy selector healing (ID, CSS, XPath, text, attributes)
- Page object auto-update with healed selectors
- Custom WebDriver `healableFind` command with transparent healing

### Auto-Regeneration on Failure
- WebDriverIO hooks that detect test failures at runtime
- Automatic DOM re-fetch and page object regeneration
- Smart retry with configurable attempts and timeouts

### Smart Locators
- Multi-strategy locator with fallback chain (ID → CSS → XPath → text → attributes)
- Dynamic element scoping and context-aware selection
- Duplicate getter detection and resolution

### Centralized Configuration
- `constants.ts` with tunable defaults for cache, healing, AI, and timeouts
- `config/index.ts` for environment variable management
- Single source of truth for all tunable parameters

### DOM Analysis & Caching
- Intelligent DOM parsing with form, button, link, and heading extraction
- Filesystem and in-memory caching with configurable TTL and entry limits
- SHA256 content-addressed cache keys to avoid redundant analysis
- DOM truncation to prevent API overload

### Error Handling & Logging
- Typed error hierarchy (`AiFrameworkError`, `URLError`, `ValidationError`, `AppError`)
- Centralized `handleError()` with context-aware messages
- Structured logging with batched async file output
- Performance metrics tracking for API calls and healing operations

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
- Healing workflow reports with per-page metrics
- Screenshot artifacts for visual debugging
- CI/CD integration ready
- Test execution tracking

## 📂 Project Structure

```
ai-wdio-framework/
├── src/
│   ├── cli.ts                                   # Main CLI entry point & orchestrator
│   ├── config/
│   │   └── index.ts                             # Environment variable config loading
│   ├── commands/
│   │   └── healableFind.ts                      # Custom WebDriver command with healing
│   ├── features/                                # Cucumber feature files (auto-generated)
│   ├── step-definitions/                        # Step definitions (auto-generated)
│   │   └── generatedSteps.ts
│   ├── page-objects/                            # Page Object Models (auto-generated)
│   │   ├── generatedPage.ts
│   │   └── generated*.ts
│   ├── services/
│   │   ├── TestGenerationService.ts            # Test artifact generation orchestration
│   │   ├── TestRunnerService.ts                # Test execution with healing integration
│   │   ├── SelectorValidationService.ts         # Pre-flight selector checks
│   │   └── autoRegeneratePromise.ts             # Auto-regeneration lifecycle
│   ├── types/
│   │   └── index.ts                             # Shared TypeScript type definitions
│   └── utils/
│       ├── ai/
│       │   ├── types.ts                        # LLMProvider interface & LLMOptions
│       │   ├── ollamaClient.ts                 # Ollama LLM client
│       │   ├── LLMClient.ts                    # High-level AI client
│       │   ├── SelfHealingLocator.ts           # AI-powered locator healing
│       │   └── promptTemplates.ts              # Prompt template management
│       ├── dom/
│       │   ├── domAnalyzer.ts                  # DOM parsing & element analysis
│       │   ├── domParser.ts                    # DOM fetching & parsing
│       │   ├── domCache.ts                     # Filesystem/memory DOM caching
│       │   └── discoverElementsFromDOM.ts      # Element discovery
│       ├── healing/
│       │   ├── healingWorkflow.ts              # Healing workflow orchestration
│       │   ├── healingService.ts               # Selector healing & page object updates
│       │   ├── autoRegenerateOnFailure.ts       # Auto DOM regeneration on failure
│       │   ├── healingHooks.ts                  # Test failure hooks
│       │   ├── selectorValidator.ts            # Selector validation against DOM
│       │   ├── selectorHelper.ts               # Alternative selector generation
│       │   └── stepExecutionWrapper.ts         # Step execution with healing
│       ├── locators/
│       │   └── smartLocator.ts                 # Multi-strategy locator with fallback
│       ├── file-parser/
│       │   ├── index.ts                        # Format detection & dispatch
│       │   ├── types.ts                        # Shared types
│       │   ├── csvParser.ts                    # CSV instruction parser
│       │   ├── excelParser.ts                  # Excel (.xlsx) instruction parser
│       │   └── docxParser.ts                   # Word (.docx) instruction parser
│       ├── cache/
│       │   └── resultCache.ts                  # Generic in-memory result cache
│       ├── validation/
│       │   ├── inputValidator.ts               # URL & instruction validation
│       │   └── codeValidator.ts                # TypeScript syntax validation
│       ├── mobile/
│       │   └── scanMobileApp.ts                # Mobile app element scanner
│       ├── test-gen/
│       │   ├── scenarioBuilder.ts              # Feature file generator
│       │   ├── stepDefinitionBuilder.ts        # Step definition generator
│       │   ├── pageObjectBuilder.ts            # Page object generator
│       │   ├── instructionParser.ts            # Structured instruction file parser
│       │   ├── scenarioClassifier.ts           # Page complexity classifier
│       │   ├── qualityValidator.ts             # Scenario quality validation
│       │   ├── duplicateGetterDetector.ts      # Duplicate getter detection
│       │   ├── enhancedSelectorGenerator.ts    # Enhanced selector generation
│       │   ├── testFailureTracker.ts           # Test failure recording
│       │   └── rerunFailedSteps.ts             # Failed step rerun logic
│       ├── constants.ts                        # Central tunable constants
│       ├── errors.ts                           # Error class hierarchy
│       ├── errorHandler.ts                     # Centralized error handling
│       ├── logger.ts                           # Structured logging
│       ├── performanceMonitor.ts               # Performance metrics
│       └── validation.ts                       # InputValidator (URL, prompt, shell, timeout)
├── configs/
│   ├── wdio.android.conf.ts                    # Android testing config
│   ├── wdio.ios.conf.ts                        # iOS testing config
│   └── wdio.shared.conf.ts                     # Shared configuration
├── wdio.conf.ts                                # Main WebDriverIO config (web)
├── tsconfig.json                               # TypeScript configuration
├── package.json                                # Project dependencies & scripts
├── instructions.json                           # Test case definitions
├── .env                                        # Environment variables (not in git)
├── .gitignore                                  # Git ignore patterns
└── README.md                                   # This file
```

## 🔧 Configuration

### Tunable Constants (`src/utils/constants.ts`)

All magic numbers and default values are centralized:

| Config Block | Key Settings |
|---|---|
| `OLLAMA_CONFIG` | `DEFAULT_BASE_URL`, `DEFAULT_MODEL`, `DEFAULT_TEMPERATURE`, `DEFAULT_MAX_TOKENS` |
| `CACHE_CONFIG` | `DOM_CACHE_VALIDITY_MS`, `MAX_FILESYSTEM_ENTRIES`, `MAX_MEMORY_ENTRIES`, `DOM_CACHE_DIR` |
| `HEALING_CONFIG` | `MAX_ATTEMPTS`, `DOM_MAX_LENGTH`, `MAX_REGENERATION_ATTEMPTS`, `REGENERATION_TIMEOUT` |
| `TIMEOUTS` | `API_TIMEOUT`, `HEALTH_CHECK_TIMEOUT`, `SELECTOR_TIMEOUT` |
| `RETRY_CONFIG` | `MAX_RETRIES`, `INITIAL_DELAY_MS`, `MAX_DELAY_MS`, `BACKOFF_FACTOR` |
| `DOM_CONFIG` | `DEFAULT_MAX_LENGTH` |

### Environment Configuration (`src/config/index.ts`)

The `getConfig()` function reads env vars and provides typed access:
- `config.ollama.baseUrl`, `config.ollama.model`, `config.ollama.disabled`
- `config.browser.headless`, `config.browser.name`
- `config.logging.level`

### WebDriverIO Settings

Edit `wdio.conf.ts` to customize:
- **Browser capabilities**: Chrome, Firefox, Safari options
- **Test timeouts**: Default timeout and action timeouts
- **Reporter settings**: Spec reporter verbosity and output format
- **Hook implementations**: Before/After test hooks for setup/cleanup
- **Services**: Local runner, devtools, mobile services

### AI Model Configuration

Set via environment variables or `constants.ts`:
- **Model**: `OLLAMA_MODEL` env var or `OLLAMA_CONFIG.DEFAULT_MODEL` (default: `llama3`)
- **Temperature**: `OLLAMA_CONFIG.DEFAULT_TEMPERATURE` (default: `0.7`)
- **Token limits**: `OLLAMA_CONFIG.DEFAULT_MAX_TOKENS` (default: `2048`)
- **Timeout**: `TIMEOUTS.API_TIMEOUT` (default: `60000ms`)

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

Detailed analysis documents were generated during code review (available from git history).

### Top Findings (Concise)

**Critical**
- `src/utils/test-gen/scenarioBuilder.ts` — references undeclared symbols (`getDOMSnapshot`, `analyzeDOM`, `OllamaClient`, `scenarioClassifier`, `promptTemplateManager`, `path`, `fs`) that were missing imports (now fixed)
- `src/utils/healing/healingWorkflow.ts` — calls `healBrokenSelector(pageName, scenario)` but API expects `(selector, elementType?)` (now fixed)
- `src/utils/healing/healingService.ts:140` — `$(selector)` called with 1 argument but `$()` expects 0
- `src/utils/healing/selectorHelper.ts` — Type assignability issues with `ChainablePromiseElement` vs `Element`
- `src/utils/test-gen/scenarioBuilder.ts` — uses `OllamaClient` directly instead of `LLMProvider` interface

**Medium**
- `src/services/TestGenerationService.ts` — uses `console.log`/`console.warn` instead of `logger`
- `src/utils/ai/ollamaClient.ts` — uses `console.warn`/`console.log`/`console.error` in some paths instead of `logger`
- `src/utils/dom/domParser.ts` — `console.error` used in some error paths
- Mix of static methods and instance methods across utility classes
- Some directories have redundant `index.ts` barrel files alongside direct imports

### Quick Wins for Contributors

- Replace remaining `console.*` calls with `logger.*` throughout the codebase
- Fix `healingService.ts:140` — `$(selector)` should accept a selector string
- Make `duplicateGetterDetector.ts` use `fs.readFileSync` instead of undeclared `readFileSync`
- Add barrel exports to `src/utils/` subdirectories for cleaner imports

## 📋 Project Cleanup & Organization

### Recent Cleanup (Latest)

**Deleted Files:**
- Test/Debug scripts: `debug_dom.ts`, `test_dom_analyzer.ts`, `regenerate_pages.ts`, `regenerate_steps.ts`
- Test output files: `test_final.txt`, `test_output.txt`, `test_run.txt`
- Duplicate documentation: All SMART_LOCATORS_*.md, VERIFICATION_*.md, MIGRATION_*.md, PAGE_SPECIFIC_*.md, and other specialized guides
- Duplicate instructions files: `instructions.auto-detect.json`, `instructions.example.json`

**Organized:**
- POC (Proof of Concept) folders moved to `/poc` directory:
  - `deepseek-coder-v2/` - LLM model caching experiments
  - `apps/` - Mobile app samples and experiments
- Kept single source of truth for documentation: `readme.md`

**Result:**
- Cleaner project structure with clear separation between production code and POC
- Single documentation file for easier maintenance
- All debug/test artifacts removed
- Clear organized structure for future development

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
1. Review the [Known Issues section](#-known-issues--improvements) above for current issues
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
