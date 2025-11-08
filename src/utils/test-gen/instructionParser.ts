/**
 * Instruction Parser - Orchestrates end-to-end test generation
 * 
 * Workflow:
 * 1. Parse instructions JSON
 * 2. Extract page elements and generate PageObject
 * 3. Generate aligned feature scenarios
 * 4. Generate matching step definitions with AI-powered refinement
 */

interface PageInfo {
  name: string;
  url: string;
  description?: string;
  elements?: string[];  // Optional: explicit element names for this page (overrides auto-detection)
}

interface InstructionTestCase {
  name: string;
  description: string;
  steps: string[];
  tags: string[];
  pages?: PageInfo[];  // Optional: specify which pages are involved
}

interface Instructions {
  projectName: string;
  url: string;
  description: string;
  testCases: InstructionTestCase[];
  pages?: PageInfo[];  // Optional: predefined page list
}

interface PageElement {
  name: string;
  type: 'input' | 'button' | 'link' | 'text' | 'select';
  description: string;
  accessor: string;
}

interface GeneratedArtifacts {
  pageObject: string;
  pageObjects?: { [pageName: string]: string };  // Multiple page objects
  featureFile: string;
  stepDefinitions: string;
  pageElements: PageElement[];
  pageContextManager?: string;  // Manager for tracking current page
}

interface StepDefinitionInfo {
  gherkinStep: string;
  keyword: string;
  stepContent: string;
  regex: string;
  implementation: string;
  params?: string[];  // Optional: parameter names captured from regex
}

interface GherkinStepInfo {
  keyword: string;
  step: string;
  original: string;
}

export class InstructionParser {
  /**
   * Detect distinct pages from test case steps
   * Returns a map of page names to their information
   */
  private detectPages(instructions: Instructions): Map<string, PageInfo> {
    const pages = new Map<string, PageInfo>();
    
    // Start with the base URL as the first page
    pages.set('login', {
      name: 'login',
      url: instructions.url,
      description: 'Login page'
    });

    // Check if instructions already have predefined pages
    if (instructions.pages && instructions.pages.length > 0) {
      instructions.pages.forEach(page => {
        pages.set(page.name, page);
      });
      return pages;
    }

    // Auto-detect pages from steps
    instructions.testCases.forEach((testCase) => {
      testCase.steps.forEach((step) => {
        const stepLower = step.toLowerCase();
        
        // Detect dashboard/success page (after successful login)
        if (stepLower.includes('logged in') || stepLower.includes('dashboard') || stepLower.includes('success')) {
          if (!pages.has('dashboard')) {
            pages.set('dashboard', {
              name: 'dashboard',
              url: `${instructions.url}logged-in-successfully/`,
              description: 'Dashboard page after successful login'
            });
          }
        }
        
        // Detect error/validation page
        if (stepLower.includes('error') && stepLower.includes('message')) {
          if (!pages.has('error')) {
            pages.set('error', {
              name: 'error',
              url: instructions.url,
              description: 'Error/validation page'
            });
          }
        }
      });

      // Check pages from test case
      if (testCase.pages) {
        testCase.pages.forEach(page => {
          if (!pages.has(page.name)) {
            pages.set(page.name, page);
          }
        });
      }
    });

    return pages;
  }

  /**
   * Extract page elements from instruction steps
   * This analyzes the natural language steps to infer page elements
   */
  private extractPageElements(instructions: Instructions): PageElement[] {
    const elements: Map<string, PageElement> = new Map();

    // Parse all test cases to find element references
    instructions.testCases.forEach((testCase) => {
      testCase.steps.forEach((step) => {
        // Extract username field
        if (step.toLowerCase().includes('username')) {
          if (!elements.has('username')) {
            elements.set('username', {
              name: 'username',
              type: 'input',
              description: 'Username input field',
              accessor: '#username',
            });
          }
        }

        // Extract password field
        if (step.toLowerCase().includes('password')) {
          if (!elements.has('password')) {
            elements.set('password', {
              name: 'password',
              type: 'input',
              description: 'Password input field',
              accessor: '#password',
            });
          }
        }

        // Extract submit button
        if (
          step.toLowerCase().includes('submit') ||
          step.toLowerCase().includes('click')
        ) {
          if (!elements.has('submit')) {
            elements.set('submit', {
              name: 'submit',
              type: 'button',
              description: 'Submit button',
              accessor: '#submit',
            });
          }
        }

        // Extract error messages specifically
        if (
          step.toLowerCase().includes('error') ||
          step.toLowerCase().includes('invalid') ||
          step.toLowerCase().includes('required') ||
          step.toLowerCase().includes('format')
        ) {
          if (!elements.has('error')) {
            elements.set('error', {
              name: 'error',
              type: 'text',
              description: 'Error message',
              accessor: '#error, [class*="error"], [id*="error"], [role="alert"], .alert-danger',
            });
          }
        }

        // Extract success messages specifically
        if (
          step.toLowerCase().includes('success') ||
          step.toLowerCase().includes('logged in') ||
          step.toLowerCase().includes('successfully')
        ) {
          if (!elements.has('success')) {
            elements.set('success', {
              name: 'success',
              type: 'text',
              description: 'Success message',
              accessor: '#success, [class*="success"], [id*="success"], .alert-success, [class*="confirmation"]',
            });
          }
        }

        // Extract generic status messages
        if (
          step.toLowerCase().includes('message') && 
          !step.toLowerCase().includes('error') && 
          !step.toLowerCase().includes('success')
        ) {
          if (!elements.has('message')) {
            elements.set('message', {
              name: 'message',
              type: 'text',
              description: 'Status message',
              accessor: '[class*="message"], .alert, [role="alert"], .post-title',
            });
          }
        }

        // Extract headings
        if (
          step.toLowerCase().includes('heading') ||
          step.toLowerCase().includes('logged in') ||
          step.toLowerCase().includes('successfully')
        ) {
          if (!elements.has('loggedInHeading')) {
            elements.set('loggedInHeading', {
              name: 'loggedInHeading',
              type: 'text',
              description: 'Logged in success heading',
              accessor: 'h1, h2, [class*="heading"], [class*="title"]',
            });
          }
        }
      });
    });

    return Array.from(elements.values());
  }

  /**
   * Extract page-specific elements
   * Priority: explicit elements in PageInfo > auto-detected from steps mentioning the page
   */
  private extractPageSpecificElements(
    pageName: string,
    pageInfo: PageInfo,
    instructions: Instructions,
    allElements: Map<string, PageElement>
  ): PageElement[] {
    // If page has explicit elements defined, use those
    if (pageInfo.elements && pageInfo.elements.length > 0) {
      return pageInfo.elements
        .map(elemName => allElements.get(elemName))
        .filter((elem): elem is PageElement => elem !== undefined);
    }

    // Auto-detect: find all elements mentioned in steps that reference this page
    const pageElements = new Set<string>();
    const pageKeywords = this.getPageKeywords(pageName);

    instructions.testCases.forEach((testCase) => {
      testCase.steps.forEach((step) => {
        const stepLower = step.toLowerCase();
        
        // Check if this step is about the current page
        const isPageStep = pageKeywords.some(keyword => stepLower.includes(keyword));

        if (isPageStep || this.isStepForAllPages(pageName, step)) {
          // Extract elements mentioned in this step
          if (stepLower.includes('username')) pageElements.add('username');
          if (stepLower.includes('password')) pageElements.add('password');
          if (stepLower.includes('submit') || stepLower.includes('click')) pageElements.add('submit');
          
          // Extract error-specific elements
          if (stepLower.includes('error') || stepLower.includes('invalid') || stepLower.includes('required') || stepLower.includes('format')) {
            pageElements.add('error');
          }
          
          // Extract success-specific elements
          if (stepLower.includes('success') || stepLower.includes('logged in') || stepLower.includes('successfully')) {
            pageElements.add('success');
          }
          
          // Extract generic message
          if (stepLower.includes('message') && !stepLower.includes('error') && !stepLower.includes('success')) {
            pageElements.add('message');
          }
          
          if (stepLower.includes('heading') || stepLower.includes('logged in') || stepLower.includes('successfully')) {
            pageElements.add('loggedInHeading');
          }
        }
      });
    });

    // For dashboard pages, ensure we have key elements
    if (pageName === 'dashboard' && pageElements.size === 0) {
      pageElements.add('message');
      pageElements.add('loggedInHeading');
    }

    // Convert element names to PageElement objects
    return Array.from(pageElements)
      .map(elemName => allElements.get(elemName))
      .filter((elem): elem is PageElement => elem !== undefined);
  }

  /**
   * Get keywords that identify a page in test steps
   */
  private getPageKeywords(pageName: string): string[] {
    const keywords: { [key: string]: string[] } = {
      login: ['login', 'sign in', 'username', 'password'],
      dashboard: ['logged in', 'dashboard', 'success', 'welcome'],
      error: ['error', 'invalid', 'fail', 'incorrect'],
    };
    return keywords[pageName] || [pageName];
  }

  /**
   * Determine if a step applies to all pages (e.g., navigation steps)
   */
  private isStepForAllPages(pageName: string, step: string): boolean {
    const stepLower = step.toLowerCase();
    
    // Steps that might apply to all pages
    if (stepLower.includes('navigate') || stepLower.includes('open')) {
      return true;
    }
    
    // For login page, include setup steps
    if (pageName === 'login' && (stepLower.includes('enter') || stepLower.includes('fills'))) {
      return !stepLower.includes('logged in') && !stepLower.includes('success');
    }

    return false;
  }

  /**
   * Generate PageObject code from extracted elements
   */
  private generatePageObject(
    instructions: Instructions,
    elements: PageElement[]
  ): string {
    const elementAccessors = elements
      .map(
        (elem) => `
  /**
   * ${elem.description}
   */
  get ${elem.name}_${elem.type}() {
    return $('${elem.accessor}');
  }`
      )
      .join('\n');

    return `// Auto-generated Page Object for: ${instructions.url}
// Generated from instructions: ${instructions.description}
import { $, browser } from '@wdio/globals';

class GeneratedPage {
${elementAccessors}

  // Common actions
  async open() {
    await browser.url('${instructions.url}');
    await this.waitForPageLoad();
  }

  async waitForPageLoad() {
    await browser.waitUntil(
      async () => (await browser.execute(() => document.readyState)) === 'complete',
      { timeout: 15000, timeoutMsg: 'Page did not load' }
    );
  }
}

export default new GeneratedPage();`;
  }

  /**
   * Generate multiple page objects - one for each distinct page in the flow
   * Each page object contains ONLY the elements relevant to that page
   */
  private generateMultiplePageObjects(
    instructions: Instructions,
    pages: Map<string, PageInfo>,
    elements: PageElement[],
    allElementsMap?: Map<string, PageElement>
  ): { [pageName: string]: string } {
    const pageObjects: { [pageName: string]: string } = {};
    
    // Convert elements array to map if not provided
    const elementsMap = allElementsMap || new Map(elements.map(e => [e.name, e]));

    pages.forEach((pageInfo, pageName) => {
      // Extract page-specific elements (respects explicit elements if defined)
      const pageSpecificElements = this.extractPageSpecificElements(
        pageName,
        pageInfo,
        instructions,
        elementsMap
      );

      // Log page-specific elements for debugging
      const elementNames = pageSpecificElements.map(e => e.name).join(', ');
      console.log(`  📄 ${pageName}: [${elementNames || 'no elements'}]`);

      const elementAccessors = pageSpecificElements
        .map(
          (elem) => `
  /**
   * ${elem.description}
   */
  get ${elem.name}_${elem.type}() {
    return $('${elem.accessor}');
  }`
        )
        .join('\n');

      // Create a page class name from the page name (e.g., "login" -> "LoginPage", "dashboard" -> "DashboardPage")
      const className = pageName.charAt(0).toUpperCase() + pageName.slice(1).toLowerCase() + 'Page';
      const instanceName = pageName.toLowerCase() + 'Page';

      const elementCount = pageSpecificElements.length;
      const elementList = pageSpecificElements.map(e => e.name).join(', ');

      pageObjects[pageName] = `// Auto-generated Page Object for ${pageInfo.name}
// Page URL: ${pageInfo.url}
// Description: ${pageInfo.description || 'Auto-detected page'}
// Elements: ${elementList || 'none'}
import { $, browser } from '@wdio/globals';

class ${className} {
${elementAccessors}

  // Common actions
  async open() {
    await browser.url('${pageInfo.url}');
    await this.waitForPageLoad();
  }

  async waitForPageLoad() {
    await browser.waitUntil(
      async () => (await browser.execute(() => document.readyState)) === 'complete',
      { timeout: 15000, timeoutMsg: 'Page did not load' }
    );
  }
}

export default new ${className}();`;
    });

    return pageObjects;
  }

  /**
   * Generate page context manager to track current page
   */
  private generatePageContextManager(pages: Map<string, PageInfo>): string {
    const pageNames = Array.from(pages.keys());
    const importStatements = pageNames
      .map(name => `import ${name}Page from './generated${name.charAt(0).toUpperCase() + name.slice(1)}Page';`)
      .join('\n');

    const pageMap = pageNames
      .map(name => `  '${name}': ${name}Page,`)
      .join('\n');

    return `// Auto-generated Page Context Manager
// Manages page objects across different pages in the test flow
${importStatements}

class PageContextManager {
  private currentPage: string = 'login';
  private pages: { [key: string]: any } = {
${pageMap}
  };

  setCurrentPage(pageName: string) {
    if (!this.pages[pageName]) {
      throw new Error(\`Unknown page: \${pageName}\`);
    }
    this.currentPage = pageName;
  }

  getCurrentPage() {
    return this.pages[this.currentPage];
  }

  getPage(pageName: string) {
    if (!this.pages[pageName]) {
      throw new Error(\`Unknown page: \${pageName}\`);
    }
    return this.pages[pageName];
  }

  getAllPages() {
    return this.pages;
  }
}

export default new PageContextManager();`;
  }

  /**
   * Convert instruction steps to natural Gherkin steps with proper keywords
   */
  private instructionStepsToGherkin(steps: string[]): GherkinStepInfo[] {
    const gherkinSteps: GherkinStepInfo[] = [];

    steps.forEach((step, index) => {
      // Smart keyword assignment based on step content
      let keyword = 'When';
      const stepLower = step.toLowerCase();
      
      if (index === 0 || stepLower.includes('navigate') || stepLower.includes('open')) {
        keyword = 'Given';
      } else if (stepLower.includes('see') || stepLower.includes('error') || stepLower.includes('success') || stepLower.includes('message') || stepLower.includes('dashboard')) {
        keyword = 'Then';
      }
      // Note: We use 'When' instead of 'And' to avoid function compatibility issues
      // All action/assertion steps after the Given will use When or Then

      const normalizedStep = this.normalizeStep(step);
      const refinedStep = this.refinedStep(normalizedStep);
      gherkinSteps.push({
        keyword,
        step: refinedStep,
        original: step
      });
    });

    return gherkinSteps;
  }

  /**
   * Normalize natural language step to Gherkin format
   * Keeps tracking for both original and normalized versions
   * Preserves case-sensitive quoted values (like "Password123")
   */
  private normalizeStep(step: string): string {
    // Extract values in quotes BEFORE lowercasing to preserve case
    const quotedValues: Map<string, string> = new Map();
    let placeholder = 0;
    
    const stepWithPlaceholders = step.replace(/'([^']+)'/g, (match, value) => {
      const key = `__preserve_${placeholder}__`;  // Use lowercase for consistency
      quotedValues.set(key, value);
      placeholder++;
      return key;
    });
    
    // Now lowercase the step text (but not the values)
    let normalized = stepWithPlaceholders
      .replace(/^User /, 'the user ')
      .toLowerCase()
      .replace(/^\w/, (c) => c.toUpperCase());
    
    // Restore the preserved values with proper quoting
    quotedValues.forEach((value, key) => {
      normalized = normalized.replace(key, `"${value}"`);
    });
    
    return normalized;
  }

  /**
   * AI-powered step refinement - improves step quality and consistency
   */
  private refinedStep(step: string): string {
    let refined = step;

    // Improve action consistency
    refined = refined
      .replace(/\bclicks?\b/gi, 'clicks')
      .replace(/\benters?\b/gi, 'enters')
      .replace(/\bsees?\b/gi, 'sees')
      .replace(/\bnavigates?\b/gi, 'navigates to')
      .replace(/\bopens?\b/gi, 'opens');

    // Standardize article usage
    refined = refined.replace(/\bthe\s+/gi, 'the ');

    return refined;
  }

  /**
   * Generate feature file from test cases
   */
  private generateFeatureFile(
    instructions: Instructions,
    testCases: InstructionTestCase[]
  ): string {
    const scenarios = testCases
      .map((testCase) => {
        const tags = testCase.tags.map((tag) => `@${tag}`).join(' ');
        const gherkinSteps = this.instructionStepsToGherkin(testCase.steps);
        
        const stepLines = gherkinSteps
          .map((stepObj) => `  ${stepObj.keyword} ${stepObj.step}`)
          .join('\n');

        return `${tags}
Scenario: ${testCase.name}
${stepLines}`;
      })
      .join('\n\n');

    return `Feature: ${instructions.projectName}
  ${instructions.description}

${scenarios}`;
  }

  /**
   * Generate step definitions from feature scenarios with proper keyword matching
   * IMPORTANT: Deduplicates based on regex pattern, not raw step text
   * This prevents duplicate registrations when steps use different parameter values
   * Now supports multi-page scenarios with page-aware page object selection
   */
  private generateStepDefinitions(
    testCases: InstructionTestCase[],
    pages: Map<string, PageInfo> = new Map()
  ): string {
    const stepDefinitions: Map<string, StepDefinitionInfo> = new Map();
    const processedRegexPatterns = new Set<string>(); // Track unique regex patterns
    const hasMultiplePages = pages.size > 1;

    testCases.forEach((testCase) => {
      const gherkinSteps = this.instructionStepsToGherkin(testCase.steps);
      
      gherkinSteps.forEach((stepObj, index) => {
        // Generate regex first to use as the deduplication key
        const regex = this.stepToRegex(stepObj.step);
        
        // Use regex pattern as key for deduplication - prevents duplicates with different param values
        const key = `${stepObj.keyword}|${regex}`;
        
        if (!processedRegexPatterns.has(key)) {
          // Extract parameter names from the step (e.g., "username", "password")
          const params = this.extractParameterNames(stepObj.step);
          
          // Generate implementation with knowledge of extracted parameters and pages
          const implementation = this.generateStepImplementation(
            stepObj.original,
            stepObj.step,
            stepObj.keyword,
            params,  // Pass params so implementation can use them
            hasMultiplePages
          );

          stepDefinitions.set(key, {
            gherkinStep: stepObj.step,
            keyword: stepObj.keyword,
            stepContent: stepObj.step,
            regex,
            implementation,
            params  // Store params for use in function signature
          });
          
          processedRegexPatterns.add(key);
        } else {
          // Log when duplicate is skipped
          console.log(`ℹ️  Skipping duplicate step pattern: ${stepObj.keyword}(${regex}) for "${stepObj.step}"`);
        }
      });
    });

    const definitions = Array.from(stepDefinitions.values())
      .map(
        (def) => {
          // Build function signature with captured parameters
          const funcParams = (def as any).params && (def as any).params.length > 0 
            ? `, async function (${(def as any).params.join(', ')}) {`
            : `, async function () {`;
          
          return `/**
 * ${def.gherkinStep}
 */
${def.keyword}(${def.regex}${funcParams}
${def.implementation}
});

`;
        }
      )
      .join('');

    // Log deduplication summary
    const totalStepsProcessed = testCases.reduce((sum, tc) => sum + tc.steps.length, 0);
    const duplicateCount = totalStepsProcessed - stepDefinitions.size;
    if (duplicateCount > 0) {
      console.log(`📌 Deduplication Summary: Processed ${totalStepsProcessed} steps, generated ${stepDefinitions.size} unique definitions (removed ${duplicateCount} duplicate(s))`);
    }

    // Build imports based on page count
    let imports = `import { Given, When, Then } from "@wdio/cucumber-framework";
import { expect, browser, $ } from '@wdio/globals';
import dotenv from 'dotenv';
import generatedPage from '../page-objects/generatedPage';
import { setupHealingHooks } from '../utils/healing/healingHooks';`;

    if (hasMultiplePages) {
      imports += `
import pageContextManager from '../page-objects/pageContextManager';`;
    }

    return `${imports}

dotenv.config();

setupHealingHooks();

/**
 * AUTO-GENERATED STEP DEFINITIONS
 * This file is automatically generated and deduplicated to prevent step pattern conflicts.
 * Each step pattern is unique to ensure proper Cucumber matching.
 * ${hasMultiplePages ? '✅ Multi-page support enabled' : ''}
 * ✅ Self-healing enabled - will auto-regenerate on step failures
 */

${definitions}`;
  }
  
  /**
   * Extract parameter names from a Gherkin step
   * E.g., 'the user enters username "student"' -> ["username"]
   *       'the user enters password "pass123"' -> ["password"]
   *       'the user sees h1 element with text "Logged in successfully"' -> ["expectedText"]
   */
  private extractParameterNames(step: string): string[] {
    const params: string[] = [];
    const lowerStep = step.toLowerCase();
    
    // Check for common parameter patterns
    if (lowerStep.includes('enters username')) {
      params.push('username');
    } else if (lowerStep.includes('enters password')) {
      params.push('password');
    } else if (lowerStep.includes('enters')) {
      // Generic "enters" pattern - use param1, param2, etc.
      const quoteCount = (step.match(/"[^"]*"/g) || []).length;
      for (let i = 0; i < quoteCount; i++) {
        params.push(`param${i + 1}`);
      }
    } else if (lowerStep.includes('text') || lowerStep.includes('message')) {
      // For assertions about text content
      const quoteCount = (step.match(/"[^"]*"/g) || []).length;
      if (quoteCount > 0) {
        params.push('expectedText');
      }
    } else if (lowerStep.includes('element')) {
      // For assertions about elements with text
      const quoteCount = (step.match(/"[^"]*"/g) || []).length;
      if (quoteCount > 0) {
        params.push('expectedText');
      }
    } else {
      // Fallback: count quoted values and generate generic params
      const quoteCount = (step.match(/"[^"]*"/g) || []).length;
      for (let i = 0; i < quoteCount; i++) {
        params.push(`param${i + 1}`);
      }
    }
    
    return params;
  }

  /**
   * Convert Gherkin step to regex pattern for Cucumber - PARAMETERIZED VERSION
   * Creates proper regex patterns that capture values instead of hardcoding them
   */
  private stepToRegex(gherkinStep: string): string {
    // Step 1: Replace quoted values with a unique placeholder marker (using lowercase to survive toLowerCase)
    let regex = gherkinStep.replace(/"[^"]*"/g, '__capture__');

    // Step 2: Lowercase
    regex = regex.toLowerCase();

    // Step 3: Escape special regex characters (but preserve the placeholder)
    regex = regex
      .replace(/\\/g, '\\\\')  // Escape backslash first
      .replace(/\./g, '\\.')   // Escape dots
      .replace(/\?/g, '\\?')   // Escape question marks
      .replace(/\*/g, '\\*')   // Escape asterisks
      .replace(/\+/g, '\\+')   // Escape plus signs
      .replace(/\[/g, '\\[')   // Escape brackets
      .replace(/\]/g, '\\]')
      .replace(/\(/g, '\\(')   // Escape parentheses
      .replace(/\)/g, '\\)')
      .replace(/\{/g, '\\{')   // Escape braces
      .replace(/\}/g, '\\}')
      .replace(/\|/g, '\\|')   // Escape pipes
      .replace(/\^/g, '\\^')   // Escape carets
      .replace(/\$/g, '\\$');   // Escape dollar signs

    // Step 4: Replace placeholder with actual capture group
    regex = regex.replace(/__capture__/g, '"([^"]*)"');

    return `/^${regex}$/`;
  }

  /**
   * Generate step implementation code with AI-powered pattern matching
   * Supports both single-page and multi-page scenarios
   */
  private generateStepImplementation(
    originalStep: string,
    gherkinStep: string,
    keyword: string,
    params: string[] = [],
    hasMultiplePages: boolean = false
  ): string {
    const step_lower = originalStep.toLowerCase();
    const gherkin_lower = gherkinStep.toLowerCase();
    const pageRef = hasMultiplePages ? 'pageContextManager.getCurrentPage()' : 'generatedPage';

    // Navigation steps (Given)
    if (keyword === 'Given' && (gherkin_lower.includes('navigates') || gherkin_lower.includes('opens'))) {
      if (hasMultiplePages && gherkin_lower.includes('dashboard')) {
        return `  try {
    pageContextManager.setCurrentPage('dashboard');
    await pageContextManager.getCurrentPage().open();
    await browser.pause(500); // Wait for page to load
  } catch (error) {
    throw new Error(\`Failed to navigate to dashboard: \${error}\`);
  }`;
      }
      return `  try {
    await ${pageRef}.open();
    await browser.pause(500); // Wait for page to load
  } catch (error) {
    throw new Error(\`Failed to navigate: \${error}\`);
  }`;
    }

    // Input steps with values (When/And) - receives captured parameter from regex
    if (gherkin_lower.includes('enters username')) {
      return `  try {
    await ${pageRef}.username_input.setValue(username);
  } catch (error) {
    throw new Error(\`Failed to enter username: \${error}\`);
  }`;
    }

    if (gherkin_lower.includes('enters password')) {
      return `  try {
    await ${pageRef}.password_input.setValue(password);
  } catch (error) {
    throw new Error(\`Failed to enter password: \${error}\`);
  }`;
    }

    if (gherkin_lower.includes('leaves') || gherkin_lower.includes('empty')) {
      return `  try {
    await ${pageRef}.password_input.clearValue();
    await browser.pause(300);
  } catch (error) {
    throw new Error(\`Failed to clear field: \${error}\`);
  }`;
    }

    // Click actions (When/And)
    if (gherkin_lower.includes('clicks') || gherkin_lower.includes('submit')) {
      return `  try {
    await ${pageRef}.submit_button.click();
    await browser.pause(500); // Wait for action
  } catch (error) {
    throw new Error(\`Failed to click button: \${error}\`);
  }`;
    }

    // Verification steps (Then) - use parameters if available
    if (keyword === 'Then' || gherkin_lower.includes('sees') || gherkin_lower.includes('message') || gherkin_lower.includes('dashboard')) {
      // Auto-detect page context for verifications
      let pageRefForVerify = pageRef;
      if (hasMultiplePages) {
        if (gherkin_lower.includes('logged in') || gherkin_lower.includes('success')) {
          pageRefForVerify = `pageContextManager.getPage('dashboard')`;
        } else if (gherkin_lower.includes('error')) {
          pageRefForVerify = `pageContextManager.getCurrentPage()`;
        }
      }

      // Detect if this is checking for an error message
      const isErrorStep = gherkin_lower.includes('error') || 
                         gherkin_lower.includes('invalid') || 
                         gherkin_lower.includes('required') ||
                         gherkin_lower.includes('format');
      
      // Detect if this is checking for a success message
      const isSuccessStep = gherkin_lower.includes('logged in') || 
                           gherkin_lower.includes('successfully') || 
                           gherkin_lower.includes('success') ||
                           gherkin_lower.includes('header');

      // Select appropriate element based on step type
      let elementSelector = `${pageRefForVerify}.message_text`;
      if (isErrorStep) {
        elementSelector = `${pageRefForVerify}.error_text || ${pageRefForVerify}.message_text`;
      } else if (isSuccessStep) {
        elementSelector = `${pageRefForVerify}.success_text || ${pageRefForVerify}.message_text`;
      }

      // If we have parameters (like expectedText), verify the content matches
      if (params.includes('expectedText')) {
        return `  try {
    const element = ${elementSelector};
    await expect(element).toBeDisplayed({ timeout: 5000 });
    const actualMessage = await element.getText();
    expect(actualMessage).toContain(expectedText);
  } catch (error) {
    throw new Error(\`Failed to verify message: \${error}\`);
  }`;
      }
      // Default verification without specific text
      return `  try {
    const element = ${elementSelector};
    await expect(element).toBeDisplayed({ timeout: 5000 });
    const actualMessage = await element.getText();
    expect(actualMessage.length).toBeGreaterThan(0);
  } catch (error) {
    throw new Error(\`Failed to verify message: \${error}\`);
  }`;
    }

    // Default implementation
    return `  try {
    // TODO: Implement this step - ${gherkinStep}
    console.log('Step implementation needed: ${gherkinStep}');
    await browser.pause(100);
  } catch (error) {
    throw new Error(\`Step failed: \${error}\`);
  }`;
  }

  /**
   * Main orchestration method - generates all artifacts from instructions
   */
  public generateFromInstructions(
    instructions: Instructions
  ): GeneratedArtifacts {
    // Step 0: Detect pages from instructions
    const pages = this.detectPages(instructions);
    console.log(`📄 Detected ${pages.size} page(s): ${Array.from(pages.keys()).join(', ')}`);

    // Step 1: Extract page elements
    const pageElements = this.extractPageElements(instructions);
    const elementsMap = new Map(pageElements.map(e => [e.name, e]));

    // Step 2: Generate aligned page object(s)
    const pageObject = this.generatePageObject(instructions, pageElements);
    const pageObjects = this.generateMultiplePageObjects(instructions, pages, pageElements, elementsMap);

    // Step 3: Generate page context manager
    const pageContextManager = this.generatePageContextManager(pages);

    // Step 4: Generate aligned feature file
    const featureFile = this.generateFeatureFile(
      instructions,
      instructions.testCases
    );

    // Step 5: Generate matching step definitions (page-aware)
    const stepDefinitions = this.generateStepDefinitions(
      instructions.testCases,
      pages
    );

    return {
      pageObject,
      pageObjects,
      featureFile,
      stepDefinitions,
      pageElements,
      pageContextManager,
    };
  }
}

export default new InstructionParser();