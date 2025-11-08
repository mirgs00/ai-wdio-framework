# Page-Specific Element Architecture - Visual Diagram

## System Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                     instructions.json                           │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  Project: Login Page Tests                             │   │
│  │  URL: https://practicetestautomation.com/...           │   │
│  │                                                         │   │
│  │  ┌─ Option A: Auto-Detection ───────────────────┐      │   │
│  │  │ testCases: [                                 │      │   │
│  │  │   { steps: [... "username" ... "success" ...] }     │   │
│  │  │ ]                                            │      │   │
│  │  └──────────────────────────────────────────────┘      │   │
│  │                                                         │   │
│  │  ┌─ Option B: Explicit Override ────────────────┐      │   │
│  │  │ pages: [                                      │      │   │
│  │  │   { name: "login", elements: [...]  }        │      │   │
│  │  │   { name: "dashboard", elements: [...] }     │      │   │
│  │  │ ]                                            │      │   │
│  │  └──────────────────────────────────────────────┘      │   │
│  └──────────────────────────────────────────────────────────┘   │
└────────────────────────────┬─────────────────────────────────────┘
                             │
                             ↓
        ┌────────────────────────────────────────────┐
        │   InstructionParser.generateFromInstructions()
        └────┬───────────────────────────────────────┘
             │
             ├─→ detectPages()
             │   └─→ Map<string, PageInfo>
             │       • login
             │       • dashboard  
             │       • error
             │
             ├─→ extractPageElements()
             │   └─→ PageElement[]
             │       • username
             │       • password
             │       • submit
             │       • message
             │
             ├─→ For EACH page:
             │   │
             │   ├─→ extractPageSpecificElements(page)
             │   │   │
             │   │   ├─ Has explicit elements?
             │   │   │   ├─ YES → Use those ✓
             │   │   │   └─ NO → Auto-detect
             │   │   │
             │   │   └─ getPageKeywords(page)
             │   │       • login: ["login", "username", ...]
             │   │       • dashboard: ["logged in", "success", ...]
             │   │       • error: ["error", "invalid", ...]
             │   │
             │   └─→ Generate page-specific page object
             │       ├─ LoginPage: [username, password, submit, message]
             │       ├─ DashboardPage: [message]
             │       └─ ErrorPage: [message, username, password]
             │
             ├─→ generatePageContextManager()
             │   └─→ Orchestrates all pages
             │
             ├─→ generateStepDefinitions()
             │   └─→ Uses pageContextManager
             │
             └─→ generateFeatureFile()
                 └─→ Gherkin scenarios
```

---

## Element Detection Flow

### Auto-Detection Process

```
┌───────────────────────────────┐
│  Test Steps                   │
└───────────────┬───────────────┘
                │
                ├─→ "User enters username 'john'"
                │   └─→ Contains "username"
                │       └─→ Login page keyword ✓
                │           └─→ Add "username" to login page
                │
                ├─→ "User enters password 'pass'"
                │   └─→ Contains "password"
                │       └─→ Login page keyword ✓
                │           └─→ Add "password" to login page
                │
                ├─→ "User clicks login button"
                │   └─→ Contains "login", "click"
                │       └─→ Login page keyword ✓
                │           └─→ Add "submit" to login page
                │
                └─→ "User sees success message"
                    └─→ Contains "success"
                        └─→ Dashboard page keyword ✓
                            └─→ Add "message" to dashboard page

    ↓ Result

┌──────────────────────────────────────┐
│ Login page: [username, password,     │
│             submit, message]         │
│                                      │
│ Dashboard page: [message]            │
│                                      │
│ Error page: [message, username,      │
│             password]                │
└──────────────────────────────────────┘
```

---

## Generated File Structure

```
                    ┌─────────────────────────────┐
                    │   Generated Artifacts       │
                    └──────────┬──────────────────┘
                               │
        ┌──────────────────────┼──────────────────────┐
        │                      │                      │
        ↓                      ↓                      ↓
   
  ┌──────────────┐      ┌──────────────┐      ┌──────────────┐
  │ Page Objects │      │ Manager      │      │ Steps & Feat │
  └──────────────┘      └──────────────┘      └──────────────┘
        │                      │                      │
        ├─→ generatedLoginPage.ts          pageContextManager.ts
        │   ✓ username_input               ├─ setCurrentPage()
        │   ✓ password_input               ├─ getCurrentPage()
        │   ✓ submit_button                ├─ getPage(name)
        │   ✓ message_text                 └─ getAllPages()
        │                                       │
        ├─→ generatedDashboardPage.ts           │
        │   ✓ message_text (only!)              ├─→ generatedSteps.ts
        │                                       │   ├─ Given/When/Then
        ├─→ generatedErrorPage.ts               │   └─ Uses pageContextManager
        │   ✓ message_text                      │
        │   ✓ username_input                    ├─→ .feature file
        │   ✓ password_input                    │   ├─ Scenarios
        │                                       │   └─ Steps
        ├─→ generatedPage.ts (legacy)           │
        │   (all elements - for compatibility)  │
        │                                       │
        └─────────────────────────────────────────
```

---

## Step Definition Generation

```
┌─────────────────────────────────────────────────┐
│  Test Step: "User enters username 'john'"       │
└────────────────┬────────────────────────────────┘
                 │
                 ├─→ Convert to regex
                 │   └─ Given(/^User enters username "([^"]*)"$/...)
                 │
                 ├─→ Determine page context
                 │   └─ Contains "username" → login page
                 │
                 ├─→ Get page object reference
                 │   ├─ const loginPage = pageContextManager.getPage('login')
                 │   └─ loginPage has: username_input ✓
                 │
                 └─→ Generate implementation
                     │
                     ├─ When(/^User enters username "([^"]*)"$/, async (username) => {
                     │   const loginPage = pageContextManager.getPage('login');
                     │   await loginPage.username_input.setValue(username);
                     │ });
                     │
                     └─ Uses correct page object ✓
                        Has correct element ✓
                        No more "element not found" errors ✓
```

---

## Context Manager in Action

```
Test Execution Timeline:

START
  │
  ├─→ pageContextManager.setCurrentPage('login')
  │   CurrentPage: login
  │   │
  │   └─→ When("User enters username") {
  │       └─ await loginPage.username_input.setValue()
  │          ↓ SUCCESS ✓
  │
  ├─→ When("User enters password") {
  │   └─ await loginPage.password_input.setValue()
  │      ↓ SUCCESS ✓
  │
  ├─→ When("User clicks login") {
  │   └─ await loginPage.submit_button.click()
  │      ↓ SUCCESS ✓
  │      └─ Page navigates to dashboard!
  │
  ├─→ pageContextManager.setCurrentPage('dashboard')
  │   CurrentPage: dashboard
  │   │
  │   └─→ Then("User sees success message") {
  │       └─ const msg = await dashboardPage.message_text.getText()
  │          ↓ SUCCESS ✓ (message_text exists on dashboard)
  │
  ├─→ pageContextManager.setCurrentPage('error')
  │   CurrentPage: error
  │   │
  │   └─→ Then("User sees error message") {
  │       ├─ const msg = await errorPage.message_text.getText()
  │       ├─ const user = await errorPage.username_input.getValue()
  │       └─ const pass = await errorPage.password_input.getValue()
  │          ↓ ALL SUCCESS ✓
  │
  END
```

---

## Comparison: Before vs After

### BEFORE (Single Page Object)

```
All pages: [username, password, submit, message]

Dashboard scenario runs:
  dashboardPage.username_input     ← ERROR! Not on dashboard!
  dashboardPage.password_input     ← ERROR! Not on dashboard!
  dashboardPage.submit_button      ← ERROR! Not on dashboard!
  dashboardPage.message_text       ← OK
```

### AFTER (Page-Specific Objects)

```
Login page: [username, password, submit, message]
Dashboard page: [message]
Error page: [message, username, password]

Dashboard scenario runs:
  dashboardPage.message_text       ← OK ✓

Login scenario runs:
  loginPage.username_input         ← OK ✓
  loginPage.password_input         ← OK ✓
  loginPage.submit_button          ← OK ✓
  loginPage.message_text           ← OK ✓

Error scenario runs:
  errorPage.message_text           ← OK ✓
  errorPage.username_input         ← OK ✓ (for retry)
  errorPage.password_input         ← OK ✓ (for retry)
```

---

## Decision Flow

```
                    START: Generate Tests
                           │
                           ├─→ instructions.json has "pages"?
                           │   │
                           │   ├─ YES (Explicit Override)
                           │   │   ├─→ Use exact elements from config
                           │   │   └─→ pages.json[i].elements[]
                           │   │
                           │   └─ NO (Auto-Detection)
                           │       ├─→ Analyze test steps
                           │       ├─→ Match keywords to pages
                           │       ├─→ Extract element names
                           │       └─→ Generate page-specific objects
                           │
                           ├─→ For each page:
                           │   ├─ Get elements for this page
                           │   ├─ Generate page object file
                           │   └─ Add to context manager
                           │
                           ├─→ Generate context manager
                           ├─→ Generate step definitions
                           ├─→ Generate feature file
                           │
                           └─→ END: All artifacts ready!
```

---

## Element Mapping Example

### Input: Test Steps

```
"User enters username 'john'"          → Contains: username
"User enters password 'pass'"          → Contains: password
"User clicks login button"             → Contains: submit
"User sees success message"            → Contains: message
"User sees error message"              → Contains: message
```

### Processing

```
                    Login Keywords?
                           │
      ┌────────────────────┼────────────────────┐
      │                    │                    │
      ↓                    ↓                    ↓
 username_input    password_input        submit_button
      │                    │                    │
      └────────────────────┴────────────────────┘
                           │
                           ↓
                  Add to LoginPage ✓


              Dashboard Keywords?
                           │
                           ↓
                    message_text
                           │
                           ↓
                 Add to DashboardPage ✓


                Error Keywords?
                      │      │
                      ↓      ↓
            message_text  +  username_input
                      │      │  password_input
                      └──────┴──────────┐
                                        ↓
                          Add to ErrorPage ✓
```

### Output: Page Objects

```
LoginPage {
  username_input
  password_input
  submit_button
  message_text
}

DashboardPage {
  message_text
}

ErrorPage {
  message_text
  username_input
  password_input
}
```

---

## Integration Points

```
┌─────────────────────────────────────────────┐
│      InstructionParser                      │
│  (Main Orchestration)                       │
└────────┬────────────────────────────────────┘
         │
         ├─→ CLI (src/cli.ts)
         │   └─ Reads instructions.json
         │   └─ Calls generateFromInstructions()
         │   └─ Writes files to disk
         │
         ├─→ Step Definitions (generated)
         │   └─ Uses pageContextManager
         │   └─ Calls correct page methods
         │
         ├─→ Feature Files (generated)
         │   └─ Maps to step definitions
         │   └─ Runs scenarios
         │
         └─→ Test Execution (WebdriverIO)
             └─ Runs feature files
             └─ Executes steps
             └─ Uses correct page objects
```

---

## Summary: Element Flow

```
Instructions.json
    ↓ (detectPages)
Pages: Map<string, PageInfo>
    ↓ (extractPageElements)
AllElements: PageElement[]
    ↓ (for each page: extractPageSpecificElements)
Page-Specific Elements ✓
    ├─ LoginPage: 4 elements
    ├─ DashboardPage: 1 element
    ├─ ErrorPage: 3 elements
    ↓ (generateMultiplePageObjects)
Page Object Files
    ├─ generatedLoginPage.ts
    ├─ generatedDashboardPage.ts
    ├─ generatedErrorPage.ts
    ↓ (generatePageContextManager)
pageContextManager.ts
    ↓ (generateStepDefinitions)
generatedSteps.ts
    ↓ (generateFeatureFile)
.feature file
    ↓ (WebdriverIO execution)
TESTS RUN ✓
```

---

## Priority Logic

```
Element on Page?
    │
    ├─ PRIORITY 1: Explicit elements in config
    │  if (pageInfo.elements) → USE THESE
    │
    └─ PRIORITY 2: Auto-detected from steps
       if (NOT explicit) → ANALYZE STEPS
            │
            ├─ Step mentions page keyword? → ADD element
            ├─ Cross-page step? → ADD to all
            └─ Otherwise → SKIP element
```

---

This architecture ensures:
✅ Each page has only its elements
✅ No "element not found" errors
✅ Clear separation of concerns
✅ Easy to understand and maintain
✅ Flexible: auto-detect OR explicit