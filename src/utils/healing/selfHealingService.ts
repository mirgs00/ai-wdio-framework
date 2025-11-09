import { browser, $ } from '@wdio/globals';
import { readFileSync, writeFileSync } from 'fs';
import * as path from 'path';
import { createOllamaClient } from '../ai/ollamaClient';
import { analyzeDOM } from '../dom/domAnalyzer';
import { discoverElementsFromDOM, DiscoveredElement } from '../dom/discoverElementsFromDOM';

export interface HealingContext {
  stepText: string;
  pageName: string;
  failedElement?: string;
  errorMessage: string;
  errorType: 'selector_not_found' | 'assertion_failed' | 'action_failed' | 'unknown';
  attemptCount: number;
}

export interface HealingResult {
  healed: boolean;
  newSelector?: string;
  newImplementation?: string;
  reason: string;
  retryable: boolean;
}

class SelfHealingService {
  private maxHealingAttempts = 2;
  private healingCache = new Map<string, HealingResult>();

  /**
   * Analyze failure and attempt to heal the step
   */
  async healStep(context: HealingContext): Promise<HealingResult> {
    const cacheKey = `${context.pageName}:${context.stepText}`;

    if (context.attemptCount > this.maxHealingAttempts) {
      return {
        healed: false,
        reason: `Max healing attempts (${this.maxHealingAttempts}) exceeded`,
        retryable: false,
      };
    }

    console.log(
      `🔧 Attempting to heal step: "${context.stepText}" (attempt ${context.attemptCount})`
    );

    try {
      // Step 1: Get current DOM
      const domHtml = await this.getCurrentDOM();
      const pageAnalysis = analyzeDOM(domHtml);
      const discoveredElements = discoverElementsFromDOM(domHtml);

      console.log(`📊 Found ${discoveredElements.length} elements on current page`);

      // Step 2: Use Ollama to determine the fix needed
      const fix = await this.generateFix(context, pageAnalysis, discoveredElements);

      if (!fix.healed) {
        return fix;
      }

      // Step 3: Update files if needed
      if (fix.newSelector) {
        await this.updatePageObject(context.pageName, context.failedElement || '', fix.newSelector);
      }

      if (fix.newImplementation) {
        await this.updateStepDefinition(context.stepText, fix.newImplementation);
      }

      return {
        ...fix,
        retryable: true,
      };
    } catch (error) {
      console.error(`❌ Healing failed: ${error instanceof Error ? error.message : error}`);
      return {
        healed: false,
        reason: `Healing service error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        retryable: false,
      };
    }
  }

  /**
   * Get current page DOM
   */
  private async getCurrentDOM(): Promise<string> {
    return await browser.execute(() => {
      return document.documentElement.outerHTML;
    });
  }

  /**
   * Use Ollama to generate a fix
   */
  private async generateFix(
    context: HealingContext,
    pageAnalysis: any,
    discoveredElements: DiscoveredElement[]
  ): Promise<HealingResult> {
    const ollamaClient = createOllamaClient();

    const elementsSummary = discoveredElements
      .slice(0, 20) // Limit to prevent token overflow
      .map(
        (el) =>
          `- ${el.tag}${el.id ? '#' + el.id : ''}${el.name ? '[name=' + el.name + ']' : ''}: "${el.text || el.placeholder || ''}" (selector: ${el.selector})`
      )
      .join('\n');

    const prompt = `You are a test automation expert. A Selenium/WebdriverIO step failed.

**Original Step (Natural Language):**
"${context.stepText}"

**Error Type:** ${context.errorType}
**Error Message:** ${context.errorMessage}
${context.failedElement ? `**Failed Element:** ${context.failedElement}` : ''}

**Current Page Analysis:**
- Title: ${pageAnalysis.title}
- Buttons: ${pageAnalysis.buttons.length}
- Links: ${pageAnalysis.links.length}
- Input Fields: ${pageAnalysis.inputFields.length}
- Headings: ${pageAnalysis.headings.length}

**Available Elements on Current Page:**
${elementsSummary}

**Task:**
1. Identify which element on the current page matches the step intent
2. Provide a CSS selector that will find it
3. If the element doesn't exist, suggest the closest alternative
4. Return ONLY valid CSS selectors, no explanations

**Response format (ONLY CSS selector, no markdown, no code blocks):**
SELECTOR: your-css-selector-here
REASON: one line explanation
ELEMENT_TYPE: input|button|text|heading|link|other`;

    try {
      const response = await ollamaClient.prompt({
        prompt,
        systemPrompt:
          'You are a test automation expert specializing in CSS selectors and WebdriverIO.',
      });

      return this.parseHealingResponse(response, context);
    } catch (error) {
      console.warn(`⚠️ Ollama healing failed: ${error instanceof Error ? error.message : error}`);
      // If Ollama fails, try fallback healing
      return this.tryFallbackHealing(context, discoveredElements, pageAnalysis);
    }
  }

  /**
   * Parse Ollama response
   */
  private parseHealingResponse(response: string, context: HealingContext): HealingResult {
    const selectorMatch = response.match(/SELECTOR:\s*(.+?)(?:\n|$)/i);
    const reasonMatch = response.match(/REASON:\s*(.+?)(?:\n|$)/i);

    if (!selectorMatch || !selectorMatch[1]) {
      return {
        healed: false,
        reason: 'Ollama could not identify selector',
        retryable: false,
      };
    }

    const selector = selectorMatch[1].trim();
    const reason = reasonMatch ? reasonMatch[1].trim() : 'Selector regenerated from DOM analysis';

    return {
      healed: true,
      newSelector: selector,
      reason,
      retryable: true,
    };
  }

  /**
   * Fallback healing when Ollama is unavailable
   */
  private tryFallbackHealing(
    context: HealingContext,
    discoveredElements: DiscoveredElement[],
    pageAnalysis: any
  ): HealingResult {
    const stepLower = context.stepText.toLowerCase();

    // Try to match step intent with discovered elements
    if (stepLower.includes('username') || stepLower.includes('email')) {
      const inputEl = discoveredElements.find(
        (el) =>
          el.tag === 'input' && el.type === 'text' && el.placeholder?.toLowerCase().includes('user')
      );
      if (inputEl) {
        return {
          healed: true,
          newSelector: inputEl.selector,
          reason: 'Matched username input field',
          retryable: true,
        };
      }
    }

    if (stepLower.includes('password')) {
      const inputEl = discoveredElements.find((el) => el.tag === 'input' && el.type === 'password');
      if (inputEl) {
        return {
          healed: true,
          newSelector: inputEl.selector,
          reason: 'Matched password input field',
          retryable: true,
        };
      }
    }

    if (stepLower.includes('button') || stepLower.includes('click')) {
      const buttonEl = discoveredElements.find(
        (el) => el.tag === 'button' || (el.tag === 'input' && el.type === 'submit')
      );
      if (buttonEl) {
        return {
          healed: true,
          newSelector: buttonEl.selector,
          reason: 'Matched button element',
          retryable: true,
        };
      }
    }

    if (
      stepLower.includes('heading') ||
      stepLower.includes('title') ||
      stepLower.includes('header')
    ) {
      const headingEl = pageAnalysis.headings[0];
      if (headingEl) {
        return {
          healed: true,
          newSelector: headingEl.selector,
          reason: 'Matched page heading',
          retryable: true,
        };
      }
    }

    if (
      stepLower.includes('message') ||
      stepLower.includes('text') ||
      stepLower.includes('error')
    ) {
      // Try success message elements
      const successEl = pageAnalysis.successElements[0];
      if (successEl) {
        return {
          healed: true,
          newSelector: successEl.selector,
          reason: 'Matched success message element',
          retryable: true,
        };
      }
      // Try error elements
      const errorEl = pageAnalysis.errorElements[0];
      if (errorEl) {
        return {
          healed: true,
          newSelector: errorEl.selector,
          reason: 'Matched error message element',
          retryable: true,
        };
      }
    }

    return {
      healed: false,
      reason: 'No matching element found in fallback healing',
      retryable: false,
    };
  }

  /**
   * Update page object file with new selector
   */
  private async updatePageObject(
    pageName: string,
    elementName: string,
    newSelector: string
  ): Promise<void> {
    const pageObjectPath = path.resolve(
      `src/page-objects/generated${this.capitalize(pageName)}Page.ts`
    );

    try {
      let content = readFileSync(pageObjectPath, 'utf-8');

      // Find the getter and update its selector
      const getterPattern = new RegExp(
        `get ${elementName}[\\s\\S]*?return \\$\\('([^']+)'\\);`,
        'i'
      );

      if (getterPattern.test(content)) {
        content = content.replace(
          getterPattern,
          `get ${elementName}() {\n    return $('${newSelector}');\n  }`
        );
        writeFileSync(pageObjectPath, content);
        console.log(`✅ Updated selector in ${pageName} page object for ${elementName}`);
      }
    } catch (error) {
      console.warn(
        `⚠️ Could not update page object: ${error instanceof Error ? error.message : error}`
      );
    }
  }

  /**
   * Update step definition with new implementation
   */
  private async updateStepDefinition(stepText: string, newImplementation: string): Promise<void> {
    const stepsPath = path.resolve('src/step-definitions/generatedSteps.ts');

    try {
      let content = readFileSync(stepsPath, 'utf-8');

      // Escape step text for regex
      const escapedStep = stepText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

      // Find the step definition matching this step pattern
      const stepPattern = new RegExp(
        `(\\/\\^[^$]*${escapedStep.substring(0, 30)}[^$]*\\$\\/[^{]*\\{[\\s\\S]*?)\\} catch \\(error\\)`,
        'i'
      );

      if (stepPattern.test(content)) {
        // Update found, replace try-catch block with new implementation
        content = content.replace(stepPattern, `$1${newImplementation}\n  } catch (error)`);
        writeFileSync(stepsPath, content);
        console.log(`✅ Updated step definition for: "${stepText}"`);
      }
    } catch (error) {
      console.warn(
        `⚠️ Could not update step definition: ${error instanceof Error ? error.message : error}`
      );
    }
  }

  private capitalize(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  /**
   * Reset healing attempts (per test scenario)
   */
  resetAttempts(): void {
    this.healingCache.clear();
  }
}

export const selfHealingService = new SelfHealingService();
