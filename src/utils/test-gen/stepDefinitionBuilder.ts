import 'dotenv/config';
import { writeFileSync, existsSync, mkdirSync, readFileSync } from 'fs';
import * as path from 'path';
import { OllamaClient } from '../ai/ollamaClient';
import { getDOMSnapshot } from '../dom/domParser';
import { load } from 'cheerio';
import { stepPatternGenerator } from './stepPatternGenerator';
import { stepQualityValidator } from './qualityValidator';

const STEP_DEFINITIONS_PATH = path.resolve('src/step-definitions');
const GENERATED_STEPS_FILE = path.join(STEP_DEFINITIONS_PATH, 'generatedSteps.ts');
const PAGE_OBJECTS_PATH = path.resolve('src/page-objects');
const GENERATED_PAGE_FILE = path.join(PAGE_OBJECTS_PATH, 'generatedPage.ts');

interface StepDefinition {
  type: 'Given' | 'When' | 'Then' | 'And';
  pattern: string;
  implementation: string;
  originalText: string;
  parameters: string[];
}

export const DEFAULT_PARAMETERS = {
  baseUrl: 'https://practicetestautomation.com',
  loginUrl: '/practice-test-login/',
  successUrl: '/logged-in-successfully/',
  username: 'student',
  password: 'Password123',
  invalidUsername: 'invalid',
  invalidPassword: 'wrongpass',
  usernameField: '#username',
  passwordField: '#password',
  submit_button: 'button[type="submit"]',
  errorElement: '.error',
  successElement: '.post-title',
  contentElement: '.content',
};

async function generatePageObjectFile(): Promise<void> {
  if (!existsSync(GENERATED_PAGE_FILE)) {
    throw new Error('GeneratedPage.ts not found. Run page object builder first.');
  }
}

/**
 * Normalizes step text for deduplication by replacing quoted values with placeholders
 * This helps identify steps with the same pattern but different parameter values
 * Example: "the user enters username \"student\"" -> "the user enters username \"<PARAM>\""
 */
function normalizeStepForDedup(stepText: string): string {
  // Replace any quoted string (double or single) with a placeholder
  return stepText.replace(/"[^"]*"/g, '"<PARAM>"').replace(/'[^']*'/g, "'<PARAM>'");
}

function extractStepsFromFeature(featureContent: string): string[] {
  const steps: string[] = [];
  const normalizedSteps = new Set<string>();
  const lines = featureContent.split('\n');

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.match(/^\s*(Given|When|Then|And|But)\s+/)) {
      const stepText = trimmed.replace(/^\s*(Given|When|Then|And|But)\s+/, '').trim();

      if (stepText) {
        // Normalize the step to check for duplicates with different parameter values
        const normalized = normalizeStepForDedup(stepText);

        if (!normalizedSteps.has(normalized)) {
          steps.push(stepText);
          normalizedSteps.add(normalized);
        } else {
          console.log(`ℹ️  Skipping duplicate step pattern: "${stepText}"`);
        }
      }
    }
  }

  return steps;
}

function determineStepType(step: string): 'Given' | 'When' | 'Then' | 'And' {
  const lowerStep = step.toLowerCase();

  if (
    lowerStep.includes('navigate') ||
    lowerStep.includes('open') ||
    lowerStep.includes('visit') ||
    lowerStep.includes('on the page') ||
    lowerStep.includes('on the login')
  ) {
    return 'Given';
  }

  if (
    lowerStep.includes('should') ||
    lowerStep.includes('verify') ||
    lowerStep.includes('expect') ||
    lowerStep.includes('see') ||
    lowerStep.includes('remain') ||
    lowerStep.includes('error message')
  ) {
    return 'Then';
  }

  if (lowerStep.includes('remain') || lowerStep.includes('form')) {
    return 'And';
  }

  return 'When';
}

function generateStepPattern(step: string): string {
  return stepPatternGenerator.generatePatternForStep(step);
}

function extractParameters(step: string): string[] {
  const paramCount = (step.match(/"[^"]*"/g) || []).length;
  const parameters: string[] = [];

  for (let i = 0; i < paramCount; i++) {
    if (step.toLowerCase().includes('navigate')) {
      parameters.push('url');
    } else if (step.toLowerCase().includes('url should contain')) {
      parameters.push('expectedPath');
    } else {
      parameters.push(`param${i + 1}`);
    }
  }

  return parameters;
}

interface PageElementInfo {
  name: string;
  selector: string;
  description: string;
  type?: string;
}

/**
 * Extracts page element information from the generated page object file
 */
function getPageElements(): PageElementInfo[] {
  try {
    const pageObjectContent = readFileSync(GENERATED_PAGE_FILE, 'utf-8');
    const elements: PageElementInfo[] = [];

    // Extract getter definitions
    const getterRegex = /get\s+(\w+)\(\)\s*{\s*return\s+\$\(['"]([^'"]+)['"]\);?\s*}/g;
    const commentRegex = /\/\*\*\s*\n\s*\*\s*(.+?)\s*\n\s*\*\//g;

    let match;
    while ((match = getterRegex.exec(pageObjectContent)) !== null) {
      const name = match[1];
      const selector = match[2];

      // Try to find description comment before the getter
      const beforeGetter = pageObjectContent.substring(0, match.index);
      const commentMatch = beforeGetter.match(/\/\*\*\s*\n\s*\*\s*(.+?)\s*\n\s*\*\//);
      const description = commentMatch ? commentMatch[1].trim() : `${name} element`;

      elements.push({
        name,
        selector,
        description,
      });
    }

    return elements;
  } catch {
    return [];
  }
}

/**
 * Uses Ollama to analyze the application and discover possible test scenarios
 */
async function discoverScenariosWithOllama(
  url: string,
  domContent: string,
  ollamaClient: OllamaClient
): Promise<string[]> {
  try {
    const $ = load(domContent);

    // Extract key elements for scenario discovery
    const forms = $('form').length;
    const inputs = $('input, textarea, select').length;
    const buttons = $('button, input[type="submit"]').length;
    const links = $('a[href]').length;

    const pageTitle = $('title').text() || 'Unknown Page';
    const headings = $('h1, h2, h3')
      .map((_, el) => $(el).text().trim())
      .get()
      .slice(0, 5)
      .join(', ');

    const prompt = `Analyze this web application and suggest test scenarios.

Application Details:
- URL: ${url}
- Page Title: ${pageTitle}
- Forms: ${forms}
- Input Fields: ${inputs}
- Buttons: ${buttons}
- Links: ${links}
- Page Headings: ${headings || 'None'}

Based on this application structure, suggest 3-5 additional test scenarios that should be covered beyond the obvious ones. 
Focus on:
1. Edge cases and error conditions
2. User workflow variations
3. Validation scenarios
4. Accessibility testing
5. Boundary conditions

Return ONLY a simple list of scenario titles (one per line), like:
- Scenario: Test X
- Scenario: Test Y

Do NOT include Gherkin syntax, just the scenario descriptions.`;

    const response = await ollamaClient.generateText(prompt, {
      temperature: 0.5,
      max_tokens: 300,
    });

    // Extract scenario suggestions
    const scenarios = response
      .split('\n')
      .filter((line) => line.trim().length > 0)
      .map((line) => line.replace(/^[-*]\s*Scenario:\s*/i, '').trim())
      .filter((line) => line.length > 10);

    return scenarios.slice(0, 5); // Limit to 5 suggestions
  } catch (error) {
    console.warn(
      '⚠️ Could not discover scenarios with Ollama:',
      error instanceof Error ? error.message : error
    );
    return [];
  }
}

/**
 * Extracts DOM structure and element information for context
 */
async function analyzeApplicationContext(url: string, dom?: string): Promise<string> {
  let domContent = dom;
  if (!domContent) {
    try {
      domContent = await getDOMSnapshot(url);
    } catch {
      return 'Unable to fetch DOM for analysis';
    }
  }

  try {
    const $ = load(domContent);
    const elements: string[] = [];

    // Extract form elements
    $('form').each((_, form) => {
      const formId = $(form).attr('id');
      const formName = $(form).attr('name');
      const formAction = $(form).attr('action');
      elements.push(
        `Form: ${formId ? `#${formId}` : formName ? `[name="${formName}"]` : 'form'}${formAction ? ` (action: ${formAction})` : ''}`
      );
    });

    // Extract input fields
    $('input, textarea, select').each((_, input) => {
      const id = $(input).attr('id');
      const name = $(input).attr('name');
      const type = $(input).attr('type') || 'text';
      const placeholder = $(input).attr('placeholder');
      const label = $(input).attr('aria-label') || $(`label[for="${id}"]`).text().trim();
      const selector = id ? `#${id}` : name ? `[name="${name}"]` : '';
      if (selector) {
        elements.push(
          `Input (${type}): ${selector}${placeholder ? ` (placeholder: "${placeholder}")` : ''}${label ? ` (label: "${label}")` : ''}`
        );
      }
    });

    // Extract buttons
    $('button, input[type="submit"], input[type="button"]').each((_, btn) => {
      const id = $(btn).attr('id');
      const text = $(btn).text().trim() || $(btn).attr('value') || $(btn).attr('aria-label');
      const selector = id ? `#${id}` : text ? `button:contains("${text}")` : 'button';
      if (text) {
        elements.push(`Button: ${selector} (text: "${text}")`);
      }
    });

    // Extract links
    $('a[href]').each((_, link) => {
      const id = $(link).attr('id');
      const text = $(link).text().trim();
      const href = $(link).attr('href');
      const selector = id ? `#${id}` : text ? `a:contains("${text}")` : '';
      if (text && text.length < 50) {
        elements.push(`Link: ${selector} (text: "${text}", href: "${href}")`);
      }
    });

    // Extract error/success message containers
    $('[class*="error"], [class*="success"], [class*="message"], [role="alert"]').each((_, el) => {
      const id = $(el).attr('id');
      const className = $(el).attr('class');
      const selector = id ? `#${id}` : className ? `.${className.split(' ')[0]}` : '';
      if (selector) {
        elements.push(`Message container: ${selector}`);
      }
    });

    return elements.length > 0
      ? `Application Elements:\n${elements.join('\n')}`
      : 'No interactive elements found';
  } catch (error) {
    return `Error analyzing DOM: ${error instanceof Error ? error.message : 'Unknown error'}`;
  }
}

function getAvailablePageMethods(): string[] {
  try {
    const pageObjectContent = readFileSync(GENERATED_PAGE_FILE, 'utf-8');
    const methodMatches = pageObjectContent.match(/async\s+(\w+?)\(/g);
    if (!methodMatches) return [];

    return methodMatches
      .map((m) => m.replace('async ', '').replace('(', ''))
      .filter((m) => !m.startsWith('_') && m !== 'constructor');
  } catch {
    return [];
  }
}

function validateTypeScript(code: string): boolean {
  try {
    // Basic syntax checks - don't use Function() as it doesn't support imports
    // Check for balanced braces and parentheses
    const openBraces = (code.match(/\{/g) || []).length;
    const closeBraces = (code.match(/\}/g) || []).length;
    const openParens = (code.match(/\(/g) || []).length;
    const closeParens = (code.match(/\)/g) || []).length;

    if (openBraces !== closeBraces || openParens !== closeParens) {
      return false;
    }

    // Check for unterminated strings (only for code blocks, not regex patterns)
    const lines = code.split('\n');
    let inString = false;
    let stringChar = '';

    for (const line of lines) {
      // Skip lines with regex patterns like Given(/^pattern$/)
      if (line.match(/^\s*(Given|When|Then)\(/)) {
        continue;
      }

      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        const prevChar = i > 0 ? line[i - 1] : '';

        // Skip escaped quotes
        if (prevChar === '\\') {
          continue;
        }

        if ((char === '"' || char === "'") && !inString) {
          inString = true;
          stringChar = char;
        } else if (char === stringChar && inString) {
          inString = false;
          stringChar = '';
        }
      }
    }

    return !inString;
  } catch {
    return false;
  }
}

async function generateWithRetry(
  prompt: string,
  ollamaClient: OllamaClient,
  retries = 2
): Promise<string> {
  let lastError: Error | null = null;

  while (retries-- > 0) {
    try {
      const result = await ollamaClient.generateText(prompt, {
        temperature: 0.1,
        max_tokens: 500,
      });

      const cleaned = cleanImplementation(result);
      if (validateTypeScript(cleaned)) {
        return cleaned;
      }
    } catch (error) {
      lastError = error as Error;
    }
  }

  throw lastError || new Error('Generation failed after retries');
}

function cleanImplementation(code: string): string {
  // First, extract just the code block if it exists
  const codeBlockMatch = code.match(/```(?:typescript|javascript)?([\s\S]*?)```/);
  if (codeBlockMatch) {
    code = codeBlockMatch[1];
  }

  // Then clean aggressively, but preserve structure
  return code
    .replace(/Here is (?:the|a)[\s\S]*?implementation:/gi, '')
    .replace(/Note that[\s\S]*?requirements\.?/gi, '')
    .replace(/I've used[\s\S]*?library\.?/gi, '')
    .replace(/```/g, '')
    .replace(/\/\/.*$/gm, '') // Remove line comments
    .replace(/\/\*[\s\S]*?\*\//g, '') // Remove block comments
    .trim();
}

async function generateStepImplementation(
  step: string,
  stepType: 'Given' | 'When' | 'Then' | 'And',
  parameters: string[],
  ollamaClient: OllamaClient,
  context?: {
    pageElements?: PageElementInfo[];
    applicationContext?: string;
    url?: string;
  }
): Promise<string> {
  // Get available page elements
  const pageElements = context?.pageElements || getPageElements();
  const applicationContext = context?.applicationContext || '';

  // Build element reference string
  const elementReferences =
    pageElements.length > 0
      ? `\nAvailable Page Elements (use these selectors in your code):\n${pageElements.map((el) => `  - ${el.name}: selector "${el.selector}" (${el.description})`).join('\n')}\n`
      : '';

  const prompt = `You are an expert WebdriverIO test automation engineer. Generate ONLY the code implementation for this step.

Step to implement: "${step}"
Step Type: ${stepType}
Function Parameters: ${parameters.length > 0 ? parameters.join(', ') : 'none'}
${elementReferences}
${applicationContext ? `\nApplication Context:\n${applicationContext}\n` : ''}

CRITICAL RULES:
1. Use WebdriverIO with async/await syntax
2. Include try/catch error handling with descriptive messages
3. Use the FUNCTION PARAMETERS (${parameters[0] || 'param1'}) directly - they are already passed to the function
4. For selectors, PREFER using the page object: generatedPage.username_input, generatedPage.password_input, generatedPage.loginButton, generatedPage.loginForm
5. For selectors not in page object, use actual element selectors (e.g., $('[class*="error"]'), $('button:contains("text")'))
6. For URLs and config, use environment variables: process.env.LOGIN_URL, process.env.SUBMIT_BUTTON, etc.
7. NEVER use DEFAULT_PARAMETERS - it doesn't exist in the generated file!
8. Return ONLY the code implementation - no markdown, no explanations, no comments
9. Validate all strings are properly terminated

Example for "I navigate to login page":
try {
  await generatedPage.open();
} catch (error) {
  const errorMessage = error instanceof Error ? error.message : String(error);
  throw new Error(\`Navigation failed: \${errorMessage}\`);
}

Example for "I enter username and password" (using page object):
try {
  await generatedPage.username_input.setValue(username);
  await generatedPage.password_input.setValue(password);
} catch (error) {
  const errorMessage = error instanceof Error ? error.message : String(error);
  throw new Error(\`Form fill failed: \${errorMessage}\`);
}

Example for "I click the login button":
try {
  await generatedPage.loginButton.click();
} catch (error) {
  const errorMessage = error instanceof Error ? error.message : String(error);
  throw new Error(\`Button click failed: \${errorMessage}\`);
}

Now generate the implementation for: "${step}"`;

  try {
    let implementation = await generateWithRetry(prompt, ollamaClient, 3);

    // Final validation and wrapping
    const trimmed = implementation.trim();
    if (!trimmed.startsWith('try {')) {
      implementation = `try {\n  ${trimmed}\n} catch (error) {\n  const errorMessage = error instanceof Error ? error.message : String(error);\n  throw new Error(\`Step execution failed: \${errorMessage}\`);\n}`;
    }

    return implementation;
  } catch (error) {
    console.warn(`⚠️ AI generation failed for "${step}": ${(error as Error).message}`);
    console.warn(`   → Using fallback implementation`);
    return generateFallbackImplementation(step, stepType, parameters, pageElements);
  }
}

function generateFallbackImplementation(
  step: string,
  stepType: 'Given' | 'When' | 'Then' | 'And',
  parameters: string[] = [],
  pageElements?: PageElementInfo[]
): string {
  const lowerStep = step.toLowerCase();

  // Navigation Steps
  if (
    stepType === 'Given' &&
    (lowerStep.includes('navigate') || lowerStep.includes('on the login'))
  ) {
    const urlParam = parameters[0] || 'url';
    if (lowerStep.includes('login')) {
      return `try {
  await generatedPage.open();
} catch (error) {
  const errorMessage = error instanceof Error ? error.message : String(error);
  throw new Error(\`Navigation failed: \${errorMessage}\`);
}`;
    }
    return `try {
  await browser.url(${urlParam});
  await browser.waitUntil(
    async () => (await browser.execute(() => document.readyState)) === 'complete',
    { timeout: 10000, timeoutMsg: 'Page did not load' }
  );
} catch (error) {
  const errorMessage = error instanceof Error ? error.message : String(error);
  throw new Error(\`Navigation failed: \${errorMessage}\`);
}`;
  }

  // Page Load Steps
  if (lowerStep.includes('wait for page load')) {
    return `try {
  await browser.waitUntil(
    async () => (await browser.execute(() => document.readyState)) === 'complete',
    { timeout: 10000, timeoutMsg: 'Page did not load' }
  );
} catch (error) {
  const errorMessage = error instanceof Error ? error.message : String(error);
  throw new Error(\`Page load failed: \${errorMessage}\`);
}`;
  }

  // Click button by name (parameterized)
  if (lowerStep.includes('click the') && lowerStep.includes('button')) {
    const buttonParam = parameters[0] || 'buttonName';
    return `try {
  const name = ${buttonParam}.toLowerCase();
  
  // Map button names to page object getters
  const buttonMap: { [key: string]: string } = {
    'login': 'submit_button',
    'submit': 'submit_button',
    'sign in': 'submit_button',
    'send': 'submit_button',
    'menu': 'openMenu_button',
    'open menu': 'openMenu_button',
    'toggle': 'openMenu_button'
  };
  
  const pageObjectGetter = buttonMap[name] || \`\${name}_button\`;
  
  if (name === 'back') {
    await browser.back();
  } else if (pageObjectGetter in generatedPage) {
    await (generatedPage as any)[pageObjectGetter].click();
  } else {
    // Fallback: try to find button by text content
    await $(\`button:contains("\${${buttonParam}}")\`).click();
  }
} catch (error) {
  const errorMessage = error instanceof Error ? error.message : String(error);
  throw new Error(\`Button click failed: \${errorMessage}\`);
}`;
  }

  // Form Submission - use actual page elements if available
  if (lowerStep.includes('submit form')) {
    const isInvalid = lowerStep.includes('invalid');
    const usernameEl = pageElements?.find(
      (el) =>
        el.name.toLowerCase().includes('username') ||
        el.selector.includes('username') ||
        el.selector.includes('#username')
    );
    const passwordEl = pageElements?.find(
      (el) =>
        el.name.toLowerCase().includes('password') ||
        el.selector.includes('password') ||
        el.selector.includes('#password')
    );
    const submitEl = pageElements?.find(
      (el) =>
        el.name.toLowerCase().includes('submit') ||
        el.selector.includes('submit') ||
        el.name.toLowerCase().includes('button')
    );

    const usernameSelector = usernameEl
      ? `'${usernameEl.selector}'`
      : 'DEFAULT_PARAMETERS.usernameField';
    const passwordSelector = passwordEl
      ? `'${passwordEl.selector}'`
      : 'DEFAULT_PARAMETERS.passwordField';
    const submitSelector = submitEl ? `'${submitEl.selector}'` : 'DEFAULT_PARAMETERS.submit_button';

    return `try {
  await $(${usernameSelector}).setValue(${isInvalid ? 'DEFAULT_PARAMETERS.invalidUsername' : 'DEFAULT_PARAMETERS.username'});
  await $(${passwordSelector}).setValue(${isInvalid ? 'DEFAULT_PARAMETERS.invalidPassword' : 'DEFAULT_PARAMETERS.password'});
  await $(${submitSelector}).click();
  ${isInvalid ? 'await expect($(DEFAULT_PARAMETERS.errorElement)).toBeDisplayed();' : 'await expect($(DEFAULT_PARAMETERS.successElement)).toBeDisplayed();'}
} catch (error) {
  const errorMessage = error instanceof Error ? error.message : String(error);
  throw new Error(\`Form submission failed: \${errorMessage}\`);
}`;
  }

  // URL Verification
  if (lowerStep.includes('url should contain')) {
    const pathParam = parameters[0] || 'expectedPath';
    return `try {
  const currentUrl = await browser.getUrl();
  await expect(currentUrl).toContain(${pathParam});
} catch (error) {
  const errorMessage = error instanceof Error ? error.message : String(error);
  throw new Error(\`URL verification failed: \${errorMessage}\`);
}`;
  }

  // Visibility Checks
  if (lowerStep.includes('should see') || lowerStep.includes('verify')) {
    let selector = '[class*="success"]';
    if (lowerStep.includes('error')) {
      selector = '[class*="error"]';
    } else if (lowerStep.includes('success')) {
      selector = '[class*="success"]';
    }
    return `try {
  await expect($(\`${selector}\`)).toBeDisplayed();
} catch (error) {
  const errorMessage = error instanceof Error ? error.message : String(error);
  throw new Error(\`Element not visible: \${errorMessage}\`);
}`;
  }

  // Success message check
  if (lowerStep.includes('success message')) {
    return `try {
  const successElement = $('[class*="success"]');
  await expect(successElement).toBeDisplayed();
} catch (error) {
  const errorMessage = error instanceof Error ? error.message : String(error);
  throw new Error(\`Success message not visible: \${errorMessage}\`);
}`;
  }

  // Form should not be submitted
  if (lowerStep.includes('form should not be submitted')) {
    return `try {
  await expect(generatedPage.loginButton).not.toBeEnabled();
} catch (error) {
  const errorMessage = error instanceof Error ? error.message : String(error);
  throw new Error(\`Form submission not prevented: \${errorMessage}\`);
}`;
  }

  // Redirected to success page
  if (lowerStep.includes('redirected to') || lowerStep.includes('should be redirected')) {
    return `try {
  const currentUrl = await browser.getUrl();
  await expect(currentUrl).toContain(process.env.SUCCESS_URL);
} catch (error) {
  const errorMessage = error instanceof Error ? error.message : String(error);
  throw new Error(\`Failed to redirect to success page: \${errorMessage}\`);
}`;
  }

  // Main page content visible
  if (lowerStep.includes('main page content should be visible')) {
    return `try {
  await expect(generatedPage.loginForm).toBeDisplayed();
} catch (error) {
  const errorMessage = error instanceof Error ? error.message : String(error);
  throw new Error(\`Main page content not visible: \${errorMessage}\`);
}`;
  }

  // Validation errors
  if (lowerStep.includes('validation errors')) {
    return `try {
  await expect($('[class*="error"]')).toBeDisplayed();
} catch (error) {
  const errorMessage = error instanceof Error ? error.message : String(error);
  throw new Error(\`Validation errors not visible: \${errorMessage}\`);
}`;
  }

  // Page header or success message with text verification
  if (
    (lowerStep.includes('page header') ||
      lowerStep.includes('success') ||
      lowerStep.includes('message')) &&
    lowerStep.includes('containing text')
  ) {
    const textParam = parameters[0] || 'expectedText';
    return `try {
  // Try to find the element in dashboard page first
  let element;
  if (typeof dashboardPage !== 'undefined' && dashboardPage) {
    // Try to find any property that looks like a success/heading/text element
    const dashboardProps = Object.getOwnPropertyNames(Object.getPrototypeOf(dashboardPage));
    const successProp = dashboardProps.find((prop: string) => 
      prop.includes('success') || prop.includes('heading') || prop.includes('text')
    );
    if (successProp && (dashboardPage as any)[successProp]) {
      element = (dashboardPage as any)[successProp];
    }
  }
  
  // Fallback to a CSS selector
  if (!element) {
    element = $('h1.post-title, [class*="success"], [class*="message"], [role="status"]');
  }
  
  await expect(element).toBeDisplayed({ timeout: 5000 });
  const actualText = await element.getText();
  expect(actualText).toContain(${textParam});
} catch (error) {
  const errorMessage = error instanceof Error ? error.message : String(error);
  throw new Error(\`Failed to verify message: \${errorMessage}\`);
}`;
  }

  // Default fallback
  return `try {
  await browser.pause(1000);
} catch (error) {
  const errorMessage = error instanceof Error ? error.message : String(error);
  throw new Error(\`Step implementation missing for: ${step}\`);
}`;
}

/**
 * Deduplicates step definitions by pattern, keeping the first occurrence
 * and logging when duplicates are found for transparency
 */
function deduplicateSteps(stepDefinitions: StepDefinition[]): StepDefinition[] {
  const seenPatterns = new Map<string, StepDefinition>();
  const duplicateLogs: string[] = [];

  for (const step of stepDefinitions) {
    const key = `${step.type}:${step.pattern}`;

    if (!seenPatterns.has(key)) {
      seenPatterns.set(key, step);
    } else {
      // If pattern already exists, keep the existing one (which was first encountered)
      const existingStep = seenPatterns.get(key);
      const message = `⚠️  Skipping duplicate pattern: ${step.type}(/${step.pattern}/) for "${step.originalText}" (already exists for "${existingStep?.originalText}")`;
      duplicateLogs.push(message);
      console.log(message);
    }
  }

  // Log summary if duplicates were found
  if (duplicateLogs.length > 0) {
    console.log(
      `\n📌 Deduplication Summary: Found and removed ${duplicateLogs.length} duplicate step definition(s)`
    );
  }

  return Array.from(seenPatterns.values());
}

function generateStepDefinitionsFile(stepDefinitions: StepDefinition[]): string {
  const imports = `import { Given, When, Then } from "@wdio/cucumber-framework";
import { expect, browser, $ } from '@wdio/globals';
import dotenv from 'dotenv';

// Import available page objects
let loginPage: any, dashboardPage: any, errorPage: any, generatedPage: any;
try { loginPage = require('../page-objects/generatedLoginPage').default; } catch (e) {}
try { dashboardPage = require('../page-objects/generatedDashboardPage').default; } catch (e) {}
try { errorPage = require('../page-objects/generatedErrorPage').default; } catch (e) {}
try { generatedPage = require('../page-objects/generatedPage').default; } catch (e) {}

dotenv.config();

/**
 * AUTO-GENERATED STEP DEFINITIONS
 * This file is automatically generated and deduplicated to prevent step pattern conflicts.
 * Each step pattern is unique to ensure proper Cucumber matching.
 * Supports multiple page objects: loginPage, dashboardPage, errorPage, generatedPage
 */

`;

  // Deduplicate steps before generating
  const deduplicatedSteps = deduplicateSteps(stepDefinitions);

  const steps = deduplicatedSteps
    .map((step) => {
      return `/**
 * Implements: "${step.originalText.replace(/"/g, '\\"')}"
 */
${step.type}(/${step.pattern}/, async function (${step.parameters.join(', ')}) {
${step.implementation}
});`;
    })
    .join('\n\n');

  if (!validateTypeScript(steps)) {
    throw new Error('Generated steps contain syntax errors');
  }

  return `${imports}${steps}`;
}

export async function buildStepDefinitions(
  featureContent: string,
  url?: string,
  domContent?: string
): Promise<void> {
  console.log('🚀 Starting step definition generation...');

  await generatePageObjectFile();

  if (!existsSync(STEP_DEFINITIONS_PATH)) {
    mkdirSync(STEP_DEFINITIONS_PATH, { recursive: true });
  }

  const steps = extractStepsFromFeature(featureContent);
  if (steps.length === 0) {
    throw new Error('No steps found in feature file');
  }

  const ollamaClient = new OllamaClient();
  const stepDefinitions: StepDefinition[] = [];

  // Analyze application context for better step generation
  console.log('🔍 Analyzing application context...');
  const pageElements = getPageElements();
  let applicationContext = '';
  const discoveredScenarios: string[] = [];

  if (url) {
    try {
      applicationContext = await analyzeApplicationContext(url, domContent);
      console.log(`✅ Analyzed ${pageElements.length} page elements`);

      // Discover additional scenarios using Ollama
      if (domContent) {
        console.log('🧠 Discovering additional test scenarios with AI...');
        const scenarios = await discoverScenariosWithOllama(url, domContent, ollamaClient);
        if (scenarios.length > 0) {
          discoveredScenarios.push(...scenarios);
          console.log(`💡 AI suggested ${scenarios.length} additional scenarios:`);
          scenarios.forEach((scenario, index) => {
            console.log(`   ${index + 1}. ${scenario}`);
          });
        }
      }
    } catch (error) {
      console.warn(
        '⚠️ Could not analyze application context:',
        error instanceof Error ? error.message : error
      );
    }
  }

  console.log(`📋 Generating implementations for ${steps.length} steps...`);

  // Check Ollama health before processing steps
  const ollamaHealthy = await ollamaClient.checkHealth();
  if (!ollamaHealthy) {
    console.warn('\n⚠️  ═══════════════════════════════════════════════════════════════');
    console.warn('⚠️  WARNING: Ollama service is not accessible');
    console.warn('⚠️  ═══════════════════════════════════════════════════════════════');
    console.warn('⚠️  AI-powered step generation is DISABLED');
    console.warn('⚠️  Using fallback basic step implementations instead');
    console.warn('⚠️  ');
    console.warn('⚠️  To enable AI features, start Ollama:');
    console.warn('⚠️    1. npm run ollama:start       (in another terminal)');
    console.warn("⚠️    2. npm run ollama:check       (verify it's running)");
    console.warn('⚠️    3. Re-run generation command');
    console.warn('⚠️  ═══════════════════════════════════════════════════════════════\n');
  } else {
    console.log('✅ Ollama service is healthy - AI-powered step generation ENABLED\n');
  }

  for (const step of steps) {
    console.log(`⚙️ Processing step: "${step}"`);
    const stepType = determineStepType(step);
    const pattern = generateStepPattern(step);
    const parameters = extractParameters(step);

    const implementation = await generateStepImplementation(
      step,
      stepType,
      parameters,
      ollamaClient,
      {
        pageElements,
        applicationContext,
        url,
      }
    );

    stepDefinitions.push({
      type: stepType,
      pattern,
      implementation,
      originalText: step,
      parameters,
    });
  }

  // Count unique patterns before deduplication
  const uniquePatterns = new Set(stepDefinitions.map((s) => `${s.type}:${s.pattern}`)).size;

  const stepDefinitionsCode = generateStepDefinitionsFile(stepDefinitions);
  writeFileSync(GENERATED_STEPS_FILE, stepDefinitionsCode, 'utf-8');

  const duplicateCount = stepDefinitions.length - uniquePatterns;
  console.log(
    `✅ Successfully generated ${uniquePatterns} unique step definitions${duplicateCount > 0 ? ` (${duplicateCount} duplicates removed)` : ''}`
  );

  const validation = stepQualityValidator.validateAllSteps(stepDefinitionsCode);
  console.log(`📝 Step Quality Score: ${validation.score}/100`);
  if (validation.warnings.length > 0) {
    console.log('⚠️ Warnings:');
    validation.warnings.slice(0, 3).forEach((w) => console.log(`   - ${w}`));
  }
}
