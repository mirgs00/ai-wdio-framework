# Logging Examples

## Real-World Log Output Examples

This document shows actual log outputs you can expect from the enhanced logging system during test generation and execution.

## Example 1: Complete Test Generation Session

```log
===== LOG SESSION STARTED: 2025-11-08T10:50:03.597Z =====

[INFO] [PAGE_OBJECT_BUILD] 🚀 Starting page object generation for: https://practicetestautomation.com/practice-test-login/
{"section":"PAGE_OBJECT_BUILD"}

[INFO] [DOM_ANALYSIS] 📄 Analyzing actual DOM from HTML...
{"section":"DOM_ANALYSIS"}

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
  "elements": [
    {
      "name": "username_input",
      "selector": "input[name='username']",
      "description": "Input field: username"
    },
    {
      "name": "password_input",
      "selector": "input[type='password']",
      "description": "Input field: password"
    },
    {
      "name": "submit_button",
      "selector": "button[type='submit']",
      "description": "Button element"
    }
  ]
}

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

[INFO] [PAGE_OBJECT_BUILD] ✅ Successfully generated all page objects for https://practicetestautomation.com/practice-test-login/
{"section":"PAGE_OBJECT_BUILD"}

[INFO] [OLLAMA_API] 🔄 Calling Ollama API (llama3)...
{
  "timestamp": "2025-11-08T10:50:07.123Z",
  "model": "llama3",
  "temperature": 0.3,
  "promptLength": 1245,
  "promptPreview": "Generate test scenarios for a login page with username and password fields..."
}

[INFO] [OLLAMA_RESPONSE] ✅ Ollama response received (487ms)
{
  "timestamp": "2025-11-08T10:50:07.610Z",
  "model": "llama3",
  "responseLength": 2847,
  "tokensUsed": null,
  "responsePreview": "Here are test scenarios for the login page:\n\n1. Successful Login:\n   - Given user is on login page\n   - When user enters valid credentials..."
}

[INFO] [OLLAMA_API] 🔄 Calling Ollama API (llama3)...
{
  "timestamp": "2025-11-08T10:50:08.234Z",
  "model": "llama3",
  "temperature": 0.3,
  "promptLength": 892,
  "promptPreview": "Generate negative test scenarios for a login page..."
}

[INFO] [OLLAMA_RESPONSE] ✅ Ollama response received (423ms)
{
  "timestamp": "2025-11-08T10:50:08.657Z",
  "model": "llama3",
  "responseLength": 1956,
  "tokensUsed": null,
  "responsePreview": "Here are negative test scenarios:\n\n1. Failed Login with wrong credentials:\n   - Given user is on login page\n   - When user enters invalid credentials..."
}

[INFO] [STEP_DEFINITION] ⚙️ Processing step: "the user navigates to login page"
{
  "timestamp": "2025-11-08T10:50:09.123Z",
  "stepPattern": "the user navigates to login page",
  "description": "Navigate to the login page",
  "implementationLength": 156,
  "implementationPreview": "Given(/^the user navigates to login page$/, async function() { await browser.url(loginPageUrl); })..."
}

[INFO] [STEP_DEFINITION] ⚙️ Processing step: "the user enters {string} into username field"
{
  "timestamp": "2025-11-08T10:50:09.234Z",
  "stepPattern": "the user enters {string} into username field",
  "description": "Enter username into the username input field",
  "implementationLength": 234,
  "implementationPreview": "When(/^the user enters \"(.*?)\" into username field$/, async function(username: string) { const element = page.username_input; await element.setValue(username); })..."
}

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

[INFO] [TEST_EXECUTION] 🧪 Test execution completed: PASS (7845ms)
{
  "timestamp": "2025-11-08T10:50:23.345Z",
  "featureName": "login_page_tests.feature",
  "status": "PASS",
  "scenarioName": "Failed Login",
  "stepsPassed": 5,
  "stepsFailed": 0,
  "stepsSkipped": 0,
  "retries": 0
}

===== PERFORMANCE SUMMARY =====
{
  "ollama_api_call": {
    "calls": 3,
    "totalMs": 1847,
    "avgMs": 616,
    "minMs": 423,
    "maxMs": 892
  },
  "page_analysis": {
    "calls": 1,
    "totalMs": 234,
    "avgMs": 234,
    "minMs": 234,
    "maxMs": 234
  }
}
```

---

## Example 2: Self-Healing Session

```log
===== LOG SESSION STARTED: 2025-11-08T11:00:00.000Z =====

[INFO] [TEST_EXECUTION] 🧪 Test execution started: Successful Login

[ERROR] Test step failed: "Then the user sees page header containing text 'Logged In Successfully'"
  Error: Expect $(`#success, [class*="success"], [id*="success"], .alert-success, [class*="confirmation"]`) to be displayed

[INFO] [SELF_HEALING] 🔧 Self-healing triggered for: Successful Login
{
  "timestamp": "2025-11-08T11:00:05.890Z",
  "testName": "Successful Login",
  "issue": "Success element selector not found - re-scanning DOM from live page",
  "regeneratedElementCount": 3,
  "regeneratedElements": [
    {
      "name": "h1.post-title",
      "type": "heading",
      "text": "Logged In Successfully",
      "selector": "h1.post-title"
    },
    {
      "name": ".success-message",
      "type": "div",
      "text": "You have successfully logged in",
      "selector": ".success-message"
    },
    {
      "name": "[role='status']",
      "type": "div",
      "text": "Login successful",
      "selector": "[role='status']"
    }
  ]
}

[INFO] [AI_INTERVENTION] 🤖 AI intervention applied
{
  "timestamp": "2025-11-08T11:00:06.234Z",
  "issue": "Success element selector failed in generatedDashboardPage.ts",
  "resolution": "Updated success_text selector to include h1.post-title: h1.post-title, #success, [class*=\"success\"], [id*=\"success\"], .alert-success, [class*=\"confirmation\"]",
  "affectedFile": "src/page-objects/generatedDashboardPage.ts"
}

[INFO] [PAGE_OBJECT_GENERATION] ✅ Generated page object: generatedDashboardPage.ts
{
  "timestamp": "2025-11-08T11:00:06.500Z",
  "pageName": "dashboard",
  "pageUrl": "https://practicetestautomation.com/practice-test-login/logged-in-successfully/",
  "elementCount": 8,
  "filename": "generatedDashboardPage.ts"
}

[INFO] [TEST_EXECUTION] 🧪 Test execution completed: PASS (5234ms)
{
  "timestamp": "2025-11-08T11:00:11.234Z",
  "featureName": "login_page_tests.feature",
  "status": "PASS",
  "scenarioName": "Successful Login",
  "stepsPassed": 5,
  "stepsFailed": 0,
  "stepsSkipped": 0,
  "retries": 1
}

===== PERFORMANCE SUMMARY =====
{
  "page_analysis": {
    "calls": 1,
    "totalMs": 156,
    "avgMs": 156,
    "minMs": 156,
    "maxMs": 156
  },
  "healing_time": {
    "calls": 1,
    "totalMs": 616,
    "avgMs": 616,
    "minMs": 616,
    "maxMs": 616
  }
}
```

---

## Example 3: Ollama API Error Handling

```log
===== LOG SESSION STARTED: 2025-11-08T11:30:00.000Z =====

[WARN] [OLLAMA_API] Ollama service not responding...

[WARN] ⚠️ Ollama API error (attempt 1/3): Connection refused

[WARN] ⏳ Retrying in 1000ms...

[INFO] [OLLAMA_API] 🔄 Calling Ollama API (llama3)...
{
  "timestamp": "2025-11-08T11:30:02.123Z",
  "model": "llama3",
  "temperature": 0.3,
  "promptLength": 1245,
  "promptPreview": "Generate test scenarios..."
}

[INFO] [OLLAMA_RESPONSE] ✅ Ollama response received (512ms)
{
  "timestamp": "2025-11-08T11:30:02.635Z",
  "model": "llama3",
  "responseLength": 2847
}
```

---

## How to Parse Logs Programmatically

### Extract JSON entries:
```bash
grep "^\{" generate_output.log | jq '.'
```

### Count API calls by type:
```bash
grep -c "OLLAMA_API" generate_output.log      # API calls
grep -c "OLLAMA_RESPONSE" generate_output.log # API responses
grep -c "SELF_HEALING" generate_output.log    # Healing events
```

### Get total Ollama API duration:
```bash
grep "OLLAMA_RESPONSE" generate_output.log | \
  jq -s 'map(.duration | tonumber) | add' | \
  awk '{print $1 "ms total Ollama time"}'
```

### Find all errors:
```bash
grep "ERROR" generate_output.log
```

### Performance metrics:
```bash
tail -50 generate_output.log | grep -A 20 "PERFORMANCE SUMMARY"
```

---

## Log File Location

- **Main log**: `generate_output.log` (project root)
- **Size**: Typically 50KB-500KB per generation run
- **Format**: Plain text with JSON metadata blocks
- **Retention**: Manual archival (no automatic rotation)

---

## What Gets Logged

| Event | Details Captured |
|-------|------------------|
| **Ollama API Call** | Model, temperature, prompt length, timestamp |
| **Ollama Response** | Response length, duration, tokens used |
| **DOM Analysis** | Elements count by type, analysis method, timing |
| **Page Objects** | Page type, element count, filename, URL |
| **Step Definitions** | Step pattern, description, implementation preview |
| **AI Intervention** | Issue, resolution, affected file |
| **Test Execution** | Feature name, pass/fail, duration, step counts |
| **Self-Healing** | Test name, regenerated elements, issue description |
| **Performance Metrics** | Operation count, total/avg/min/max durations |

---

## Example: Parsing for Analytics

```javascript
const fs = require('fs');

// Read log file
const logContent = fs.readFileSync('generate_output.log', 'utf-8');

// Extract all JSON objects
const jsonMatches = logContent.match(/^\{[\s\S]*?\n\}/gm) || [];
const entries = jsonMatches.map(j => JSON.parse(j));

// Analyze
const stats = {
  totalApiCalls: entries.filter(e => e.model === 'llama3').length,
  totalElements: entries
    .filter(e => e.elementCount)
    .reduce((sum, e) => sum + e.elementCount, 0),
  healingEvents: entries.filter(e => e.issue && e.regeneratedElements).length,
  avgApiDuration: Math.round(
    entries
      .filter(e => e.duration)
      .reduce((sum, e) => sum + e.duration, 0) / 
    entries.filter(e => e.duration).length
  )
};

console.log('📊 Generation Statistics:', stats);
```

