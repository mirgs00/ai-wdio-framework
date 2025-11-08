# Comprehensive Logging Guide

## Overview

The AI WebdriverIO Framework includes an enhanced logging system that captures detailed information about:
- **Ollama API usage**: API calls, response times, token usage
- **DOM element discovery**: Elements found per page, analysis metadata
- **Step definition generation**: Each step created based on instructions
- **AI interventions**: How AI fixed errors or enhanced test generation
- **Test execution**: Test runs, pass/fail status, performance metrics
- **Self-healing**: When tests are auto-fixed due to DOM changes

All logs are written to **`generate_output.log`** in the project root, in addition to console output.

## Logging Architecture

### Logger Implementation

Location: `src/utils/logger.ts`

The enhanced Logger class provides:
- **File-based logging**: All logs written to `generate_output.log`
- **Console output**: Real-time feedback during execution
- **Structured logging**: Contextual information in each log entry
- **Performance metrics**: Automatic tracking of operation durations
- **Multiple log levels**: DEBUG, INFO, WARN, ERROR

### Key Methods

#### Basic Logging
```typescript
logger.info(message: string, context?: LogContext)
logger.warn(message: string, context?: LogContext)
logger.error(message: string, error?: Error)
logger.debug(message: string, context?: LogContext)
```

#### Specialized Logging
```typescript
// Ollama API interactions
logger.logOllamaApiCall(prompt: string, model: string, temperature: number)
logger.logOllamaResponse(response: string, model: string, duration: number, tokensUsed?: number)

// DOM Analysis
logger.logElementDiscovery(pageName: string, elements: unknown[], metadata?: Record<string, unknown>)

// Page Object Generation
logger.logPageObjectGeneration(pageName: string, pageUrl: string, elementCount: number, filename: string)

// Step Definitions
logger.logStepDefinition(stepPattern: string, description: string, implementation: string)

// AI Interventions
logger.logAiIntervention(issue: string, resolution: string, affectedFile: string)

// Test Execution
logger.logTestExecution(featureName: string, status: 'PASS' | 'FAIL', duration: number, summary?: Record<string, unknown>)

// Self-Healing
logger.logHealing(testName: string, issue: string, regeneratedElements?: unknown[])
```

#### Performance Tracking
```typescript
// Record individual operation duration
logger.recordMetric(category: string, duration: number)

// Get performance summary
logger.getSummary(): Record<string, unknown>

// Log summary to both console and file
logger.logSummary(title: string)
```

## Usage Examples

### 1. Tracking Ollama API Calls

**File**: `src/utils/ai/ollamaClient.ts`

```typescript
import { logger } from '../logger';

async private attemptGenerateText(prompt: string, options?: OllamaOptions): Promise<string> {
  const startTime = Date.now();
  
  // Log API call with details
  logger.logOllamaApiCall(prompt, this.model, options?.temperature || 0.3);

  try {
    const response = await fetch(url, { /* ... */ });
    const duration = Date.now() - startTime;
    
    // Record performance metric
    logger.recordMetric('ollama_api_call', duration);
    
    // Log response with timing
    const data = (await response.json()) as OllamaResponse;
    logger.logOllamaResponse(data.response, this.model, duration);
    
    return data.response;
  } catch (error) {
    logger.error('Ollama API failed', error);
    throw error;
  }
}
```

**Generated Log Output**:
```
[INFO] [OLLAMA_API] 🔄 Calling Ollama API (llama3)...
{
  "timestamp": "2025-11-08T10:50:05.123Z",
  "model": "llama3",
  "temperature": 0.3,
  "promptLength": 1245,
  "promptPreview": "Generate test scenarios for a login page..."
}
[INFO] [OLLAMA_RESPONSE] ✅ Ollama response received (487ms)
{
  "timestamp": "2025-11-08T10:50:05.610Z",
  "model": "llama3",
  "responseLength": 2847,
  "tokensUsed": null,
  "responsePreview": "1. Successful Login with valid credentials..."
}
```

### 2. Logging DOM Element Discovery

**File**: `src/utils/test-gen/pageObjectBuilder.ts`

```typescript
import { logger } from '../logger';

async function identifyPageElements(url: string, htmlContent?: string): Promise<PageElement[]> {
  logger.info('📄 Analyzing actual DOM from HTML...', { section: 'DOM_ANALYSIS' });
  
  const analysis = analyzeDOM(htmlContent);
  const elements: PageElement[] = [];
  
  // ... build elements array ...
  
  // Log discovered elements with metadata
  logger.logElementDiscovery('actual_dom', elements, {
    url,
    method: 'static_analysis',
    analysisTime: Date.now() - startTime,
    elementsByType: {
      inputs: analysis.inputFields.length,
      buttons: analysis.buttons.length,
      links: analysis.links.length,
      headings: analysis.headings.length,
      errors: analysis.errorElements.length,
      success: analysis.successElements.length
    }
  });
  
  return elements;
}
```

**Generated Log Output**:
```
[INFO] [DOM_ANALYSIS] 📄 Analyzing actual DOM from HTML...
[INFO] [DOM_ANALYSIS] 📊 Elements discovered on actual_dom
{
  "timestamp": "2025-11-08T10:50:06.123Z",
  "pageName": "actual_dom",
  "elementCount": 16,
  "url": "https://practicetestautomation.com/practice-test-login/",
  "method": "static_analysis",
  "analysisTime": 234,
  "elementsByType": {
    "inputs": 2,
    "buttons": 1,
    "links": 3,
    "headings": 1,
    "errors": 0,
    "success": 1
  },
  "elements": [ /* full element list */ ]
}
```

### 3. Logging Page Object Generation

**File**: `src/utils/test-gen/pageObjectBuilder.ts`

```typescript
export async function buildPageObjects(url: string, htmlContent?: string): Promise<void> {
  const pageElements = await identifyPageElements(url, htmlContent);
  
  // Generate and log page object
  const pageObjectCode = generatePageObjectFile(pageElements, url);
  writeFileSync(GENERATED_PAGE_FILE, pageObjectCode, 'utf-8');
  
  logger.logPageObjectGeneration('generic', url, pageElements.length, 'generatedPage.ts');
  
  if (htmlContent) {
    const pageType = detectPageType(htmlContent, url);
    const pageObjectsByType = generatePageObjectsByType(pageElements, url, pageType);
    
    for (const [pageName, code] of Object.entries(pageObjectsByType)) {
      const filename = `generated${capitalize(pageName)}Page.ts`;
      writeFileSync(path.join(PAGE_OBJECTS_PATH, filename), code, 'utf-8');
      
      logger.logPageObjectGeneration(pageName, url, pageElements.length, filename);
    }
  }
}
```

**Generated Log Output**:
```
[INFO] [PAGE_OBJECT_GENERATION] ✅ Generated page object: generatedPage.ts
{
  "timestamp": "2025-11-08T10:50:06.500Z",
  "pageName": "generic",
  "pageUrl": "https://practicetestautomation.com/practice-test-login/",
  "elementCount": 16,
  "filename": "generatedPage.ts"
}
[INFO] [PAGE_OBJECT_GENERATION] ✅ Generated page object: generatedLoginPage.ts
{
  "timestamp": "2025-11-08T10:50:06.600Z",
  "pageName": "login",
  "pageUrl": "https://practicetestautomation.com/practice-test-login/",
  "elementCount": 14,
  "filename": "generatedLoginPage.ts"
}
[INFO] [PAGE_OBJECT_GENERATION] ✅ Generated page object: generatedDashboardPage.ts
{
  "timestamp": "2025-11-08T10:50:06.700Z",
  "pageName": "dashboard",
  "pageUrl": "https://practicetestautomation.com/practice-test-login/logged-in-successfully/",
  "elementCount": 8,
  "filename": "generatedDashboardPage.ts"
}
```

### 4. Logging Step Definition Generation

**File**: `src/utils/test-gen/stepDefinitionBuilder.ts` (future integration)

```typescript
logger.logStepDefinition(
  'the user enters {string} into {string}',
  'Step for entering user input into a field',
  `Then(/^the user enters "(.*?)" into "(.*?)"$/, async function(value: string, field: string) {
    const element = await getFieldByName(field);
    await element.setValue(value);
  })`
);
```

**Generated Log Output**:
```
[INFO] [STEP_DEFINITION] ⚙️ Processing step: "the user enters {string} into {string}"
{
  "timestamp": "2025-11-08T10:50:07.123Z",
  "stepPattern": "the user enters {string} into {string}",
  "description": "Step for entering user input into a field",
  "implementationLength": 245,
  "implementationPreview": "Then(/^the user enters \"(.*?)\" into \"(.*?)\"$/, async function..."
}
```

### 5. Logging AI Interventions

**File**: `src/utils/healing/autoRegenerateOnFailure.ts` (future integration)

```typescript
logger.logAiIntervention(
  'Step "I submit the input" not found',
  'Added missing step definition with AI-generated implementation using button element detection',
  'src/step-definitions/generatedSteps.ts'
);
```

**Generated Log Output**:
```
[INFO] [AI_INTERVENTION] 🤖 AI intervention applied
{
  "timestamp": "2025-11-08T10:50:08.234Z",
  "issue": "Step \"I submit the input\" not found",
  "resolution": "Added missing step definition with AI-generated implementation using button element detection",
  "affectedFile": "src/step-definitions/generatedSteps.ts"
}
```

### 6. Logging Test Execution

**File**: `wdio.conf.ts` hooks (future integration)

```typescript
afterTest: async function(test, context, { error, result, duration, passed, retries }) {
  logger.logTestExecution(test.title, passed ? 'PASS' : 'FAIL', duration, {
    scenarioName: test.parent,
    stepsPassed: result?.passed || 0,
    stepsFailed: result?.failed || 0,
    stepsSkipped: result?.skipped || 0,
    retries
  });
}
```

**Generated Log Output**:
```
[INFO] [TEST_EXECUTION] 🧪 Test execution completed: PASS (8723ms)
{
  "timestamp": "2025-11-08T10:50:15.500Z",
  "featureName": "login_page_tests.feature",
  "status": "PASS",
  "scenarioName": "Successful Login",
  "stepsPassed": 5,
  "stepsFailed": 0,
  "stepsSkipped": 0,
  "retries": 0
}
```

### 7. Logging Self-Healing

**File**: `src/utils/healing/healingHooks.ts` (current integration)

```typescript
logger.logHealing(
  'Invalid selector for success message',
  'DOM re-scanned from live page, found h1.post-title element',
  regeneratedElements
);
```

**Generated Log Output**:
```
[INFO] [SELF_HEALING] 🔧 Self-healing triggered for: Successful Login
{
  "timestamp": "2025-11-08T10:50:09.890Z",
  "testName": "Successful Login",
  "issue": "DOM re-scanned from live page, found h1.post-title element",
  "regeneratedElementCount": 3,
  "regeneratedElements": [
    { "name": "h1.post-title", "type": "heading", "text": "Logged In Successfully" },
    { "name": ".success-message", "type": "div", "text": "You have successfully logged in" },
    { "name": "[role='status']", "type": "div", "text": "Login successful" }
  ]
}
```

## Log File Format

The `generate_output.log` file contains:

```
===== LOG SESSION STARTED: 2025-11-08T10:50:03.597Z =====

[INFO] [PAGE_OBJECT_BUILD] 🚀 Starting page object generation for: https://practicetestautomation.com/practice-test-login/
{ "section": "PAGE_OBJECT_BUILD" }

[INFO] [DOM_ANALYSIS] 📄 Analyzing actual DOM from HTML...
{ "section": "DOM_ANALYSIS" }

[INFO] [DOM_ANALYSIS] 📊 Elements discovered on actual_dom
{
  "timestamp": "2025-11-08T10:50:06.123Z",
  "pageName": "actual_dom",
  "elementCount": 16,
  ...
}

[INFO] [PAGE_OBJECT_GENERATION] ✅ Generated page object: generatedLoginPage.ts
{
  "timestamp": "2025-11-08T10:50:06.600Z",
  ...
}

[INFO] [OLLAMA_API] 🔄 Calling Ollama API (llama3)...
{
  "timestamp": "2025-11-08T10:50:05.123Z",
  "model": "llama3",
  "temperature": 0.3,
  ...
}

[INFO] [OLLAMA_RESPONSE] ✅ Ollama response received (487ms)
{
  "timestamp": "2025-11-08T10:50:05.610Z",
  "model": "llama3",
  "responseLength": 2847,
  ...
}

===== PERFORMANCE SUMMARY =====
{
  "ollama_api_call": {
    "calls": 5,
    "totalMs": 2847,
    "avgMs": 569,
    "minMs": 420,
    "maxMs": 892
  }
}
```

## Performance Metrics

Track performance across test generation and execution:

```typescript
import { logger } from './src/utils/logger';

// Automatic metric recording
logger.recordMetric('page_load', 234);
logger.recordMetric('page_load', 267);
logger.recordMetric('page_load', 245);

// Get performance summary
const summary = logger.getSummary();
// Returns:
// {
//   "page_load": {
//     "calls": 3,
//     "totalMs": 746,
//     "avgMs": 249,
//     "minMs": 234,
//     "maxMs": 267
//   }
// }

// Log the summary
logger.logSummary('Test Generation Performance Report');
```

## Best Practices

### 1. Always Include Context
```typescript
// ✅ Good
logger.info('Page object generated', {
  section: 'PAGE_OBJECT_BUILD',
  details: { pageType: 'login', elementCount: 12 }
});

// ❌ Poor
logger.info('Page object generated');
```

### 2. Use Appropriate Log Levels
```typescript
logger.debug('Detailed diagnostic info for developers');    // DEBUG
logger.info('General progress/milestones');                 // INFO
logger.warn('Non-critical issues that need attention');     // WARN
logger.error('Critical errors that must be addressed');     // ERROR
```

### 3. Record Metrics for Performance-Critical Operations
```typescript
const startTime = Date.now();

// ... operation ...

const duration = Date.now() - startTime;
logger.recordMetric('operation_name', duration);
```

### 4. Specialized Logging for Domain Operations
Use domain-specific logging methods instead of generic `info()`:
```typescript
// ✅ Specialized - rich context
logger.logOllamaApiCall(prompt, model, temperature);

// ❌ Generic - less useful
logger.info('Calling Ollama API');
```

## Accessing Logs

### View in Real-Time
```bash
# Watch the log file during test generation
tail -f generate_output.log
```

### Analyze After Execution
```bash
# View last 50 lines
tail -50 generate_output.log

# Search for specific sections
grep "OLLAMA_API" generate_output.log

# Search for errors
grep "ERROR" generate_output.log

# Count API calls
grep -c "OLLAMA_API" generate_output.log
```

### Parse Structured Data
```javascript
// Load and parse JSON entries from log file
const fs = require('fs');
const logs = fs.readFileSync('generate_output.log', 'utf-8');
const jsonEntries = logs.match(/\{[\s\S]*?\}/g).map(s => JSON.parse(s));
```

## Future Enhancements

- [ ] Rotating log files (archive when > 10MB)
- [ ] Log aggregation for CI/CD pipelines
- [ ] Dashboard for visualizing performance metrics
- [ ] Log export to JSON for analysis tools
- [ ] Real-time log streaming to remote service
