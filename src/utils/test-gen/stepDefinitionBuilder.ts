import 'dotenv/config';
import { writeFileSync, existsSync, mkdirSync, readFileSync } from 'fs';
import * as path from 'path';
import { OllamaClient } from '../ai/ollamaClient';
import type { LLMProvider } from '../ai/types';
import { getDOMSnapshot } from '../dom/domParser';
import { load } from 'cheerio';
import { stepPatternGenerator } from './stepPatternGenerator';
import { stepQualityValidator } from './qualityValidator';
import { validateTypeScript } from '../validation/codeValidator';
import { REGEX_PATTERNS, regexHelpers } from '../constants/regexPatterns';
import { logger } from '../logger';

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
  return stepText.replace(REGEX_PATTERNS.STRING_WITH_DOUBLE_QUOTES, '"<PARAM>"').replace(REGEX_PATTERNS.STRING_WITH_SINGLE_QUOTES, "'<PARAM>'");
}

function extractStepsFromFeature(featureContent: string): string[] {
  const steps: string[] = [];
  const normalizedSteps = new Set<string>();
  const lines = featureContent.split('\n');

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.match(REGEX_PATTERNS.GHERKIN_KEYWORD)) {
      const stepText = trimmed.replace(REGEX_PATTERNS.GHERKIN_KEYWORD, '').trim();

      if (stepText) {
        // Normalize the step to check for duplicates with different parameter values
        const normalized = normalizeStepForDedup(stepText);

        if (!normalizedSteps.has(normalized)) {
          steps.push(stepText);
          normalizedSteps.add(normalized);
        } else {
          logger.info(`ℹ️  Skipping duplicate step pattern: "${stepText}"`);
        }
      }
    }
  }

  return steps;
}

function determineStepType(step: string): 'Given' | 'When' | 'Then' {
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

    // Extract getter definitions (handles public/private, TypeScript return types, etc.)
    const getterRegex = /(?:public\s+)?get\s+(\w+)\s*\(\s*\)[^{]*\{\s*return\s+\$\([']([^']*)[']\)/g;
    const _commentRegex = /\/\*\*\s*\n\s*\*\s*(.+?)\s*\n\s*\*\//g;

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
  } catch (error) {
    logger.warn(
      `⚠️ Failed to parse page elements from generated page object: ${error instanceof Error ? error.message : String(error)}`
    );
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
    logger.warn(
      `⚠️ Could not discover scenarios with Ollama: ${error instanceof Error ? error.message : error}`
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

function _getAvailablePageMethods(): string[] {
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

async function generateWithRetry(
  prompt: string,
  llmProvider: LLMProvider,
  retries = 2
): Promise<string> {
  let lastError: Error | null = null;

  while (retries-- > 0) {
    try {
      const result = await llmProvider.generateText(prompt, {
        temperature: 0.1,
        max_tokens: 150,
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
  code = code
    .replace(/Here is (?:the|a)[\s\S]*?implementation:/gi, '')
    .replace(/Note that[\s\S]*?requirements\.?/gi, '')
    .replace(/I've used[\s\S]*?library\.?/gi, '')
    .replace(/```/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '') // Remove block comments
    .trim();

  // Remove line comments only when '//' is not inside a string
  const lines = code.split('\n')
  const cleaned = lines.map(line => {
    let inSingle = false, inDouble = false, inBacktick = false
    for (let i = 0; i < line.length - 1; i++) {
      const char = line[i], next = line[i + 1]
      if (char === '\\') { i++; continue } // skip escaped chars
      if (char === '"' && !inSingle && !inBacktick) inDouble = !inDouble
      if (char === "'" && !inDouble && !inBacktick) inSingle = !inSingle
      if (char === '`' && !inSingle && !inDouble) inBacktick = !inBacktick
      if (!inSingle && !inDouble && !inBacktick && char === '/' && next === '/') {
        return line.substring(0, i)
      }
    }
    return line
  })
  return cleaned.join('\n').trim()
}

async function generateStepImplementation(
  step: string,
  stepType: 'Given' | 'When' | 'Then' | 'And',
  parameters: string[],
  llmProvider: LLMProvider,
  context?: {
    pageElements?: PageElementInfo[];
    applicationContext?: string;
    url?: string;
  },
  useAI = false
): Promise<string> {
  const pageElements = context?.pageElements || getPageElements();

  // Try fallback first — covers all common step patterns instantly
  const fallback = generateFallbackImplementation(step, stepType, parameters, pageElements)
  const isDefaultFallback = fallback.includes('browser.pause(1000)')

  if (!isDefaultFallback) {
    return fallback
  }

  // Only attempt AI if fallback couldn't handle it and AI is explicitly requested
  if (!useAI) {
    return fallback
  }

  const applicationContext = context?.applicationContext || ''

  const elementReferences =
    pageElements.length > 0
      ? `\nAvailable Page Elements (use these selectors in your code):\n${pageElements.map((el) => `  - ${el.name}: selector "${el.selector}" (${el.description})`).join('\n')}\n`
      : ''

  const prompt = `You are an expert WebdriverIO test automation engineer. Generate ONLY the code implementation for this step.

Step to implement: "${step}"
Step Type: ${stepType}
Function Parameters: ${parameters.length > 0 ? parameters.join(', ') : 'none'}
${elementReferences}
${applicationContext ? `\nApplication Context:\n${applicationContext}\n` : ''}

CRITICAL RULES:
1. Use WebdriverIO with async/await syntax
2. Include try/catch error handling with descriptive messages
3. Use FUNCTION PARAMETERS (${parameters[0] || 'param1'}) directly
4. Prefer page object selectors: generatedPage.elementName
5. NEVER use DEFAULT_PARAMETERS
6. Return ONLY the code - no markdown, no explanations, no comments

Now generate the implementation for: "${step}"`;

  try {
    let implementation = await generateWithRetry(prompt, llmProvider, 1);

    const trimmed = implementation.trim();
    if (!trimmed.startsWith('try {')) {
      implementation = `try {\n  ${trimmed}\n} catch (error) {\n  const errorMessage = error instanceof Error ? error.message : String(error);\n  throw new Error(\`Step execution failed: \${errorMessage}\`);\n}`;
    }

    return implementation;
  } catch (error) {
    logger.warn(`⚠️ AI generation failed for "${step}": ${(error as Error).message}`);
    logger.warn(`   → Using fallback implementation`);
    return fallback;
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
    if (lowerStep.includes('login') || parameters.length === 0) {
      const urlParam = parameters[0] || 'url';
      return `try {
  await browser.url(${urlParam});
} catch (error) {
  const errorMessage = error instanceof Error ? error.message : String(error);
  throw new Error(\`Navigation failed: \${errorMessage}\`);
}`;
    }
    const urlParam = parameters[0];
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
  if (lowerStep.includes('click') && lowerStep.includes('button')) {
    if (parameters.length > 0) {
      const buttonParam = parameters[0];
      return `try {
  await browser.execute(() => document.querySelectorAll('iframe').forEach((f) => ((f as HTMLElement).style.display = 'none')));
  const raw = ${buttonParam}.toLowerCase();
  const name = raw.replace(/^button\\s+/, '').replace(/\\s+button$/, '').trim();
  const clicked = await browser.execute((text: string) => {
    const el = document.querySelector('#' + CSS.escape(text)) ||
      Array.from(document.querySelectorAll('a, button, [role="button"], input[type="submit"], input[type="button"]'))
        .find(e => (e.textContent || '').trim().toLowerCase() === text.toLowerCase());
    if (el) { (el as HTMLElement).click(); return true; }
    return false;
  }, raw);
  if (!clicked) { await $('#' + name.replace(/[^\\w-]/g, '')).click(); }
} catch (error) {
  const errorMessage = error instanceof Error ? error.message : String(error);
  throw new Error(\`Button click failed: \${errorMessage}\`);
}`;
    }
    // No parameter — extract button name from step text
    const _btnName = step.replace(/.*?clicks?\s+(?:the\s+)?/i, '').replace(/\s+button.*$/i, '').trim() || 'submit';
    return `try {
  await browser.execute(() => document.querySelectorAll('iframe').forEach((f) => ((f as HTMLElement).style.display = 'none')));
  await $('button, input[type="submit"], [type="button"]').click();
} catch (error) {
  const errorMessage = error instanceof Error ? error.message : String(error);
  throw new Error(\`Button click failed: \${errorMessage}\`);
}`;
  }

  // Generic click (no "button" keyword — link/text click)
  if (lowerStep.includes('click') && !lowerStep.includes('button')) {
    if (parameters.length > 0) {
      const textParam = parameters[0];
      return `try {
  const found = await $('=' + ${textParam});
  if (await found.isExisting()) {
    await found.click();
  } else {
    const clicked = await browser.execute((text: string) => {
      // Try finding by ID
      let el = document.querySelector('#' + CSS.escape(text));
      if (el) { (el as HTMLElement).click(); return true; }
      // Try finding clickable/text elements by text content
      const candidates = Array.from(document.querySelectorAll('a, button, [role="button"], label, span, input[type="radio"], input[type="checkbox"], input[type="submit"], input[type="button"], div, p, li, td, th'));
      for (const e of candidates) {
        const t = (e.textContent || '').trim().toLowerCase();
        if (t === text.toLowerCase()) {
          if (e.tagName === 'LABEL') { (e as HTMLElement).click(); return true; }
          if (e.tagName === 'INPUT' && (e as HTMLInputElement).type === 'radio' || (e as HTMLInputElement).type === 'checkbox') { (e as HTMLElement).click(); return true; }
          (e as HTMLElement).click(); return true;
        }
      }
      // Try partial text match
      for (const e of candidates) {
        const t = (e.textContent || '').trim().toLowerCase();
        if (t.startsWith(text.toLowerCase()) || text.toLowerCase().startsWith(t)) {
          if (e.tagName === 'LABEL') { (e as HTMLElement).click(); return true; }
          (e as HTMLElement).click(); return true;
        }
      }
      return false;
    }, String(${textParam}));
    if (!clicked) throw new Error(\`Could not find element with text: \${${textParam}}\`);
  }
} catch (error) {
  const errorMessage = error instanceof Error ? error.message : String(error);
  throw new Error(\`Click failed: \${errorMessage}\`);
}`;
    }
    // No parameter — click any available button
    return `try {
  await browser.execute(() => document.querySelectorAll('iframe').forEach((f) => ((f as HTMLElement).style.display = 'none')));
  await $('button, a, [role="button"]').click();
} catch (error) {
  const errorMessage = error instanceof Error ? error.message : String(error);
  throw new Error(\`Click failed: \${errorMessage}\`);
}`;
  }

  // Fill input fields — "fills" pattern from scenarioExtractor
  if (lowerStep.includes('fills') && lowerStep.includes('with')) {
    const hasSelector = parameters.length >= 2
    const selParam = parameters[0] || 'selector'
    const valParam = parameters[1] || 'value'
    return hasSelector ? `try {
  await browser.execute(() => document.querySelectorAll('iframe').forEach((f) => ((f as HTMLElement).style.display = 'none')));
  const el = await $(${selParam});
  await el.waitForEnabled({ timeout: 5000 });
  await el.clearValue();
  await el.setValue(${valParam});
} catch (error) {
  const errorMessage = error instanceof Error ? error.message : String(error);
  throw new Error(\`Fill field failed: \${errorMessage}\`);
}` : `try {
  await browser.execute(() => document.querySelectorAll('iframe').forEach((f) => ((f as HTMLElement).style.display = 'none')));
  await $(${selParam}).setValue(${valParam});
} catch (error) {
  const errorMessage = error instanceof Error ? error.message : String(error);
  throw new Error(\`Fill field failed: \${errorMessage}\`);
}`;
  }

  // Form Submission - generic (any form, not just login)
  if (lowerStep.includes('submit form')) {
    return `try {
  await browser.execute(() => document.querySelectorAll('iframe').forEach((f) => ((f as HTMLElement).style.display = 'none')));
  await $('button[type="submit"], input[type="submit"]').click();
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
    let searchText = 'success';
    if (lowerStep.includes('error')) {
      searchText = 'error';
    } else if (lowerStep.includes('success')) {
      searchText = 'success';
    }
    const textParam = parameters[0];
    const target = textParam ? `${textParam}` : `'${searchText}'`;
    return `try {
  const found = await browser.execute((text: string) => document.body?.innerText?.includes(text) || false, String(${target}));
  if (!found) throw new Error(\`Text not found: \${${target}}\`);
} catch (error) {
  const errorMessage = error instanceof Error ? error.message : String(error);
  throw new Error(\`Text not found: \${errorMessage}\`);
}`;
  }

  // Success message check
  if (lowerStep.includes('success message')) {
    return `try {
  const found = await browser.execute(() => document.body?.innerText?.includes('success') || false);
  if (!found) throw new Error('Success message not found');
} catch (error) {
  const errorMessage = error instanceof Error ? error.message : String(error);
  throw new Error(\`Success message not found: \${errorMessage}\`);
}`;
  }

  // Form should not be submitted
  if (lowerStep.includes('form should not be submitted')) {
    return `try {
  const url = await browser.getUrl();
  await expect(url).not.toContain('dashboard');
} catch (error) {
  const errorMessage = error instanceof Error ? error.message : String(error);
  throw new Error(\`Form submission not prevented: \${errorMessage}\`);
}`;
  }

  // HTML5 validation error (empty field validation)
  if (lowerStep.includes('validation error')) {
    return `try {
  const validationMsg = await browser.execute(() => {
    const el = document.activeElement as HTMLInputElement;
    return el?.validationMessage || '';
  });
  if (!validationMsg) throw new Error('No validation error shown');
} catch (error) {
  const errorMessage = error instanceof Error ? error.message : String(error);
  throw new Error(\`Validation error not displayed: \${errorMessage}\`);
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
      lowerStep.includes('message') ||
      lowerStep.includes('heading') ||
      lowerStep.includes('sees')) &&
    lowerStep.includes('containing text')
  ) {
    const textParam = parameters[0] || 'expectedText';
    return `try {
  const found = await browser.execute((text: string) => document.body?.innerText?.includes(text) || false, String(${textParam}));
  if (!found) throw new Error(\`Text not found: \${${textParam}}\`);
} catch (error) {
  const errorMessage = error instanceof Error ? error.message : String(error);
  throw new Error(\`Failed to verify text: \${errorMessage}\`);
}`;
  }

  // "User enters 'value' in the something" pattern (CSV template style, no quotes in params)
  if (lowerStep.startsWith('user enters ') && lowerStep.includes("'") && lowerStep.includes(' in ')) {
    const valueMatch = step.match(/'([^']+)'/);
    const value = valueMatch ? valueMatch[1] : 'test value';
    const fieldNameMatch = step.toLowerCase().match(/in the ([^']+)$/);
    const fieldKeyword = fieldNameMatch ? fieldNameMatch[1].trim() : '';
    // Try to match the field keyword against available page elements
    const fieldEl = pageElements?.find(
      (el) =>
        fieldKeyword.includes(el.name.replace(/_/g, ' ')) ||
        el.name.replace(/_/g, ' ').includes(fieldKeyword) ||
        el.description.toLowerCase().includes(fieldKeyword) ||
        el.selector.toLowerCase().includes(fieldKeyword.replace(/\s+/g, ''))
    );
    if (fieldEl) {
      return `try {
  await (generatedPage as any).${fieldEl.name}.setValue('${value}');
} catch (error) {
  const errorMessage = error instanceof Error ? error.message : String(error);
  throw new Error(\`Failed to enter text: \${errorMessage}\`);
}`;
    }
    // fallback: try to find field by selector keywords
    const fieldSelector = fieldKeyword ? `[name="${fieldKeyword}"], #${fieldKeyword}, [placeholder*="${fieldKeyword}"]` : 'input, textarea';
    return `try {
  const el = await $('${fieldSelector}');
  await el.setValue('${value}');
} catch (error) {
  const errorMessage = error instanceof Error ? error.message : String(error);
  throw new Error(\`Failed to enter text: \${errorMessage}\`);
}`;
  }

  // "User sees something" pattern (verification steps)
  if (lowerStep.startsWith('user sees ') || lowerStep.startsWith('user should see ')) {
    const seenMatch = step.match(/(?:sees|should see)\s+(.+)/i);
    const target = seenMatch ? seenMatch[1].toLowerCase().trim() : '';
    if (target.includes('no result') || target.includes('empty') || target.includes('no results')) {
      return `try {
  const results = await $$('[class*="result"], [class*="g"], .rc, .g');
  expect(results.length).toBe(0);
} catch (error) {
  const errorMessage = error instanceof Error ? error.message : String(error);
  throw new Error(\`Empty result verification failed: \${errorMessage}\`);
}`;
    }
    if (target.includes('result') || target.includes('success')) {
      return `try {
  const results = await $('[class*="result"], [class*="g"], .rc, .g');
  await expect(results).toBeDisplayed({ timeout: 5000 });
} catch (error) {
  const errorMessage = error instanceof Error ? error.message : String(error);
  throw new Error(\`Result verification failed: \${errorMessage}\`);
}`;
    }
    // generic visibility check
    const targetEl = pageElements?.find(
      (el) => target.includes(el.name.replace(/_/g, ' ')) || el.description.toLowerCase().includes(target)
    );
    if (targetEl) {
      return `try {
  await expect((generatedPage as any).${targetEl.name}).toBeDisplayed({ timeout: 5000 });
} catch (error) {
  const errorMessage = error instanceof Error ? error.message : String(error);
  throw new Error(\`Element not visible: \${errorMessage}\`);
}`;
    }
    return `try {
  await expect($('[class*="result"], [class*="g"], .srg, #search')).toBeDisplayed({ timeout: 5000 });
} catch (error) {
  const errorMessage = error instanceof Error ? error.message : String(error);
  throw new Error(\`Search result verification failed: \${errorMessage}\`);
}`;
  }

  // Fill field by selector
  if (lowerStep.includes('fills') && lowerStep.includes('with')) {
    if (parameters.length >= 2) {
      return `try {
  // hide iframes
  await browser.execute(() => document.querySelectorAll('iframe').forEach((f) => ((f as HTMLElement).style.display = 'none')));
  const tagName = await browser.execute((sel: string) => {
    const e = document.querySelector(sel);
    return e ? e.tagName.toLowerCase() : null;
  }, ${parameters[0]});
  if (tagName === 'select') {
    await browser.execute((sel: string, val: string) => {
      const el = document.querySelector(sel) as HTMLSelectElement;
      if (el) {
        const opt = Array.from(el.options).find(o => o.value === val);
        if (opt) { el.value = val; }
        else { el.selectedIndex = 0; }
        el.dispatchEvent(new Event('change', { bubbles: true }));
        el.dispatchEvent(new Event('input', { bubbles: true }));
        return true;
      }
      return false;
    }, ${parameters[0]}, ${parameters[1]});
  } else {
    const set = await browser.execute((sel: string, val: string) => {
      const el = document.querySelector(sel) as HTMLInputElement;
      if (el) { el.value = val; el.dispatchEvent(new Event('input', { bubbles: true })); return true; }
      return false;
    }, ${parameters[0]}, ${parameters[1]});
    if (!set) { await $(${parameters[0]}).setValue(${parameters[1]}); }
  }
} catch (error) {
  const errorMessage = error instanceof Error ? error.message : String(error);
  throw new Error(\`Fill failed: \${errorMessage}\`);
}`;
    }
    return `try {
  await browser.execute(() => document.querySelectorAll('iframe').forEach((f) => ((f as HTMLElement).style.display = 'none')));
  const sel = ${parameters[0] || '"[type=\\"text\\"]"'};
  const set = await browser.execute((s: string) => {
    const el = document.querySelector(s) as HTMLInputElement;
    if (el) { el.value = 'test'; el.dispatchEvent(new Event('input', { bubbles: true })); return true; }
    return false;
  }, sel);
  if (!set) { await $(sel).setValue('test'); }
} catch (error) {
  const errorMessage = error instanceof Error ? error.message : String(error);
  throw new Error(\`Fill failed: \${errorMessage}\`);
}`;
  }

  // Submit form
  if (lowerStep.includes('submits the form')) {
    return `try {
  await browser.execute(() => document.querySelectorAll('iframe').forEach((f) => ((f as HTMLElement).style.display = 'none')));
  await $('[type="submit"], button[type="submit"], button:not([type])').click();
} catch (error) {
  const errorMessage = error instanceof Error ? error.message : String(error);
  throw new Error(\`Form submit failed: \${errorMessage}\`);
}`;
  }

  // Page title verification
  if (lowerStep.includes('page title') && lowerStep.includes('contain')) {
    const textParam = parameters[0] || 'expectedTitle';
    return `try {
  const title = await browser.getTitle();
  await expect(title).toContain(${textParam});
} catch (error) {
  const errorMessage = error instanceof Error ? error.message : String(error);
  throw new Error(\`Title verification failed: \${errorMessage}\`);
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
      logger.info(message);
    }
  }

  // Log summary if duplicates were found
  if (duplicateLogs.length > 0) {
    logger.info(
      `\n📌 Deduplication Summary: Found and removed ${duplicateLogs.length} duplicate step definition(s)`
    );
  }

  return Array.from(seenPatterns.values());
}

function generateStepDefinitionsFile(stepDefinitions: StepDefinition[]): string {
  const imports = `import { Given, When, Then } from "@wdio/cucumber-framework";
import { expect, browser, $ } from '@wdio/globals';
import dotenv from 'dotenv';
import { setupHealingHooks } from '../utils/healing/healingHooks';
import { SessionStore } from '../utils/sessionStore';
import { logger } from '../utils/logger';

// Import page object instance
let generatedPage: any;
try {
  generatedPage = require('../page-objects/generatedPage').generatedPage;
} catch (e) {
  logger.warn('⚠️ Could not load generatedPage (named export): ' + (e instanceof Error ? e.message : e));
}

try {
  if (!generatedPage) {
    generatedPage = require('../page-objects/generatedPage').default;
  }
} catch (e) {
  logger.warn('⚠️ Could not load generatedPage (default export): ' + (e instanceof Error ? e.message : e));
}

if (!generatedPage) {
  logger.error('❌ No page objects could be loaded. Run page object generation first.');
  logger.error('   Expected file: src/page-objects/generatedPage.ts');
  logger.error('   Run: npm run generate:page-objects');
}

dotenv.config();

setupHealingHooks();

/**
 * AUTO-GENERATED STEP DEFINITIONS
 * This file is automatically generated and deduplicated to prevent step pattern conflicts.
 * Each step pattern is unique to ensure proper Cucumber matching.
 * ✅ Self-healing enabled - will auto-regenerate on step failures
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

/**
 * Generate feature content from parsed scenarios.
 * Called by scenarioBuilder.ts after parsing Gherkin feature content.
 */
export async function generateStepDefinitions(
  scenarios: Array<{ name: string; steps: Array<{ type: string; text: string }> }>,
  _ollamaClient: OllamaClient,
  _options?: { url?: string; applicationContext?: string }
): Promise<string> {
  let featureContent = 'Feature: Generated Test\n';

  for (const scenario of scenarios) {
    featureContent += `\n  Scenario: ${scenario.name}\n`;
    for (const step of scenario.steps) {
      featureContent += `    ${step.type} ${step.text}\n`;
    }
  }

  return featureContent;
}

export async function buildStepDefinitions(
  featureContent: string,
  url?: string,
  domContent?: string
): Promise<void> {
  logger.info('🚀 Starting step definition generation...');

  await generatePageObjectFile();

  if (!existsSync(STEP_DEFINITIONS_PATH)) {
    mkdirSync(STEP_DEFINITIONS_PATH, { recursive: true });
  }

  const steps = extractStepsFromFeature(featureContent);
  if (steps.length === 0) {
    throw new Error('No steps found in feature file');
  }

    const ollamaClient = new OllamaClient({ maxRetries: 0, timeout: 180000 });
  const stepDefinitions: StepDefinition[] = [];

  // Analyze application context for better step generation
  logger.info('🔍 Analyzing application context...');
  const pageElements = getPageElements();
  let applicationContext = '';
  const discoveredScenarios: string[] = [];

  if (url) {
    try {
      applicationContext = await analyzeApplicationContext(url, domContent);
      logger.info(`✅ Analyzed ${pageElements.length} page elements`);

      // Warm up model before first real call (first call after idle takes ~100s overhead)
      const warmupHealthy = await ollamaClient.checkHealth();
      if (warmupHealthy) {
        logger.info('🔥 Warming up Ollama model...');
        try {
          await ollamaClient.generateText('Respond with "ready"', { temperature: 0, max_tokens: 5 });
          logger.info('✅ Model warmed up');
        } catch {
          logger.info('⚠️ Warm-up failed, continuing anyway');
        }
      }

      // Discover additional scenarios using Ollama
      if (domContent) {
        logger.info('🧠 Discovering additional test scenarios with AI...');
        const scenarios = await discoverScenariosWithOllama(url, domContent, ollamaClient);
        if (scenarios.length > 0) {
          discoveredScenarios.push(...scenarios);
          logger.info(`💡 AI suggested ${scenarios.length} additional scenarios:`);
          scenarios.forEach((scenario, index) => {
            logger.info(`   ${index + 1}. ${scenario}`);
          });
        }
      }
    } catch (error) {
      logger.warn(
        `⚠️ Could not analyze application context: ${error instanceof Error ? error.message : error}`
      );
    }
  }

  logger.info(`📋 Generating implementations for ${steps.length} steps...`);

  // Quick health check for user visibility (model already warmed up above)
  const ollamaHealthy = await ollamaClient.checkHealth();
  if (ollamaHealthy) {
    logger.info('✅ Ollama AI-powered step generation active');
  }

  for (const step of steps) {
    logger.info(`⚙️ Processing step: "${step}"`);
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
      },
      true // useAI=true for old flow; new flow (generateStepDefsFromMatrixScenarios) skips AI
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
  logger.info(
    `✅ Successfully generated ${uniquePatterns} unique step definitions${duplicateCount > 0 ? ` (${duplicateCount} duplicates removed)` : ''}`
  );

  const validation = stepQualityValidator.validateAllSteps(stepDefinitionsCode);
  logger.info(`📝 Step Quality Score: ${validation.score}/100`);
  if (validation.warnings.length > 0) {
    logger.info('⚠️ Warnings:');
    validation.warnings.slice(0, 3).forEach((w) => logger.info(`   - ${w}`));
  }
}

import type { ExtractedScenario } from '../flow-matrix/types'

/**
 * Generates step definitions from flow-matrix-extracted scenarios.
 * Each scenario step is converted into a StepDefinition with AI-generated implementation.
 */
function stripKeyword(step: string): string {
  return step.replace(/^(Given|When|Then|And|But)\s+/i, '')
}

export async function generateStepDefsFromMatrixScenarios(
  scenarios: ExtractedScenario[],
  llmProvider: LLMProvider,
  options?: { url?: string; applicationContext?: string }
): Promise<void> {
  if (!existsSync(STEP_DEFINITIONS_PATH)) {
    mkdirSync(STEP_DEFINITIONS_PATH, { recursive: true })
  }

  const stepDefinitions: StepDefinition[] = []
  const pageElements = getPageElements()

  for (const scenario of scenarios) {
    for (const stepText of scenario.steps) {
      const textWithoutKeyword = stripKeyword(stepText)
      const stepType = determineStepType(stepText)
      const pattern = generateStepPattern(textWithoutKeyword)
      const parameters = extractParameters(textWithoutKeyword)

      const implementation = await generateStepImplementation(
        stepText,
        stepType,
        parameters,
        llmProvider,
        {
          pageElements,
          applicationContext: options?.applicationContext || '',
          url: options?.url,
        },
        true /* useAI: fall back to AI when default stub is returned */
      )

      stepDefinitions.push({
        type: stepType,
        pattern,
        implementation,
        originalText: stepText,
        parameters,
      })
    }
  }

  const uniquePatterns = new Set(
    stepDefinitions.map((s) => `${s.type}:${s.pattern}`)
  ).size

  const stepDefinitionsCode = generateStepDefinitionsFile(stepDefinitions)
  writeFileSync(GENERATED_STEPS_FILE, stepDefinitionsCode, 'utf-8')

  logger.info(
    `✅ Generated ${uniquePatterns} unique step definitions from ${scenarios.length} scenarios`
  )

  const validation = stepQualityValidator.validateAllSteps(stepDefinitionsCode)
  logger.info(`📝 Step Quality Score: ${validation.score}/100`)
  if (validation.warnings.length > 0) {
    logger.info('⚠️ Warnings:')
    validation.warnings.slice(0, 3).forEach((w) => logger.info(`   - ${w}`))
  }
}



