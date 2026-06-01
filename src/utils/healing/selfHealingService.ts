import { browser } from '@wdio/globals';
import * as fs from 'fs';
import * as path from 'path';
import { createOllamaClient } from '../ai/ollamaClient';
import { getInteractableBrowserElements, getBrowserAccessibilityTree } from '@wdio/mcp/snapshot';
import type { BrowserElementInfo, AccessibilityNode } from '@wdio/mcp/snapshot';
import { HEALING_CONFIG } from '../constants';
import { logger } from '../logger';
import { healingArchivist } from './healingArchivist';

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
  private maxHealingAttempts = HEALING_CONFIG.MAX_ATTEMPTS;
  private healingCache = new Map<string, HealingResult>();

  /**
   * Analyze failure and attempt to heal the step
   */
  async healStep(context: HealingContext): Promise<HealingResult> {
    if (context.attemptCount > this.maxHealingAttempts) {
      return {
        healed: false,
        reason: `Max healing attempts (${this.maxHealingAttempts}) exceeded`,
        retryable: false,
      };
    }

    logger.info(`Attempting to heal step: "${context.stepText}" (attempt ${context.attemptCount})`, {
      section: 'SELF_HEALING',
      details: { stepText: context.stepText, attempt: context.attemptCount, pageName: context.pageName },
    });

    try {
      // Step 1: Get current page elements via MCP snapshot (in-browser detection)
      const elements = await getInteractableBrowserElements(browser);
      const accessibilityTree = await getBrowserAccessibilityTree(browser);

      logger.info(`Found ${elements.length} interactable elements on current page`, {
        section: 'SELF_HEALING',
        details: { elementCount: elements.length, treeSize: accessibilityTree.length },
      });

      // Step 2: Use Ollama to determine the fix needed
      const fix = await this.generateFix(context, elements, accessibilityTree);

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

      if (fix.healed) {
        healingArchivist.recordHealing({
          timestamp: new Date().toISOString(),
          originalSelector: context.failedElement || context.stepText,
          newSelector: fix.newSelector || '',
          reason: fix.reason,
          page: context.pageName,
          success: true,
          method: 'ollama',
          duration: 0,
        });
      }

      return {
        ...fix,
        retryable: true,
      };
    } catch (error) {
      logger.error(`Healing failed`, error as Error);
      return {
        healed: false,
        reason: `Healing service error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        retryable: false,
      };
    }
  }

  /**
   * Get page context summary from MCP snapshot for logging
   */
  private summarizePageContext(elements: BrowserElementInfo[], tree: AccessibilityNode[]): string {
    const buttons = elements.filter((e) => e.tagName === 'button' || e.type === 'submit');
    const inputs = elements.filter((e) => e.tagName === 'input' || e.tagName === 'select' || e.tagName === 'textarea');
    const links = elements.filter((e) => e.tagName === 'a');
    const headings = tree.filter((n) => ['heading', 'banner'].includes(n.role));
    return `Buttons: ${buttons.length}, Inputs: ${inputs.length}, Links: ${links.length}, Headings: ${headings.length}`;
  }

  /**
   * Use Ollama to generate a fix with MCP-powered element context
   */
  private async generateFix(
    context: HealingContext,
    elements: BrowserElementInfo[],
    accessibilityTree: AccessibilityNode[]
  ): Promise<HealingResult> {
    try {
      const ollamaClient = createOllamaClient();

      const elementsSummary = elements
        .slice(0, 25) // Limit to prevent token overflow
        .map(
          (el) =>
            `- <${el.tagName}>${el.name ? ` name="${el.name}"` : ''}${el.type ? ` type="${el.type}"` : ''}${el.tagName === 'a' && el.href ? ` href="${el.href}"` : ''}: "${el.value || el.name || ''}" (selector: ${el.selector})${el.isInViewport ? '' : ' [outside viewport]'}`
        )
        .join('\n');

      const treeSummary = accessibilityTree
        .slice(0, 15)
        .map((n) => `- [${n.role}] "${n.name}" (selector: ${n.selector})`)
        .join('\n');

      const prompt = `You are a test automation expert. A Selenium/WebdriverIO step failed.

**Original Step (Natural Language):**
"${context.stepText}"

**Error Type:** ${context.errorType}
**Error Message:** ${context.errorMessage}
${context.failedElement ? `**Failed Element:** ${context.failedElement}` : ''}

**Current Page — Interactable Elements (via MCP snapshot):**
${elementsSummary}

**Accessibility Tree (top-level):**
${treeSummary}

**Task:**
1. Identify which element on the current page matches the step intent
2. Provide a CSS or aria selector that will find it uniquely
3. If the element doesn't exist, suggest the closest alternative
4. Return ONLY the selector, no explanations

**Response format (ONLY CSS selector, no markdown, no code blocks):**
SELECTOR: your-selector-here
REASON: one line explanation
ELEMENT_TYPE: input|button|text|heading|link|other`;

      const response = await ollamaClient.prompt({
        prompt,
        systemPrompt:
          'You are a test automation expert specializing in CSS selectors and WebdriverIO.',
      });

      return this.parseHealingResponse(response, context);
    } catch (error) {
      logger.warn('Ollama healing failed, trying fallback', { section: 'SELF_HEALING', details: { error: error instanceof Error ? error.message : String(error) } });
      // If Ollama fails, try fallback healing
      return this.tryFallbackHealing(context, elements, accessibilityTree);
    }
  }

  /**
   * Parse Ollama response
   */
  private parseHealingResponse(response: string, _context: HealingContext): HealingResult {
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
   * Fallback healing when Ollama is unavailable (MCP-powered)
   */
  private tryFallbackHealing(
    context: HealingContext,
    elements: BrowserElementInfo[],
    accessibilityTree: AccessibilityNode[]
  ): HealingResult {
    const stepLower = context.stepText.toLowerCase();

    if (stepLower.includes('username') || stepLower.includes('email')) {
      const inputEl = elements.find(
        (el) =>
          el.tagName === 'input' &&
          (el.type === 'text' || el.type === 'email') &&
          (el.name?.toLowerCase().includes('user') || el.name?.toLowerCase().includes('email'))
      );
      if (inputEl) {
        return { healed: true, newSelector: inputEl.selector, reason: 'Matched username/email input via MCP', retryable: true };
      }
    }

    if (stepLower.includes('password')) {
      const inputEl = elements.find((el) => el.tagName === 'input' && el.type === 'password');
      if (inputEl) {
        return { healed: true, newSelector: inputEl.selector, reason: 'Matched password input via MCP', retryable: true };
      }
    }

    if (stepLower.includes('button') || stepLower.includes('click') || stepLower.includes('submit')) {
      const buttonEl = elements.find(
        (el) => el.tagName === 'button' || (el.tagName === 'input' && el.type === 'submit') || el.tagName === 'a'
      );
      if (buttonEl) {
        return { healed: true, newSelector: buttonEl.selector, reason: 'Matched button/link via MCP', retryable: true };
      }
    }

    if (stepLower.includes('heading') || stepLower.includes('title') || stepLower.includes('header')) {
      const headingEl = accessibilityTree.find((n) => n.role === 'heading');
      if (headingEl) {
        return { healed: true, newSelector: headingEl.selector, reason: 'Matched heading via MCP accessibility tree', retryable: true };
      }
    }

    if (stepLower.includes('message') || stepLower.includes('text') || stepLower.includes('error')) {
      const alertEl = accessibilityTree.find((n) => n.role === 'alert');
      if (alertEl) {
        return { healed: true, newSelector: alertEl.selector, reason: 'Matched alert element via MCP accessibility tree', retryable: true };
      }
      const firstEl = elements.find((e) => e.name?.toLowerCase().includes('error') || e.name?.toLowerCase().includes('success'));
      if (firstEl) {
        return { healed: true, newSelector: firstEl.selector, reason: `Matched element via accessible name: "${firstEl.name}"`, retryable: true };
      }
    }

    return {
      healed: false,
      reason: 'No matching element found in MCP-based fallback healing',
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
      let content = fs.readFileSync(pageObjectPath, 'utf-8');

      // Find the getter and update its selector (handle public prefix and type annotations)
      const getterPattern = new RegExp(
        `((?:public\\s+)?)get\\s+${elementName}\\s*\\(\\s*\\)\\s*[^{]*\\{\\s*return\\s+\\$\\('([^']+)'\\);`,
        'i'
      );

      if (getterPattern.test(content)) {
        content = content.replace(
          getterPattern,
          `$1get ${elementName}() {\n    return $('${newSelector}');\n  }`
        );
        fs.writeFileSync(pageObjectPath, content);
        logger.info(`Updated selector in ${pageName} page object for ${elementName}`, { section: 'SELF_HEALING' });
      }
    } catch (error) {
      logger.warn(`Could not update page object for ${pageName}`, { section: 'SELF_HEALING', details: { error: error instanceof Error ? error.message : String(error) } });
    }
  }

  /**
   * Update step definition with new implementation
   */
  private async updateStepDefinition(stepText: string, newImplementation: string): Promise<void> {
    const stepsPath = path.resolve('src/step-definitions/generatedSteps.ts');
    
    if (!fs.existsSync(stepsPath)) {
      logger.warn(`Step definitions file not found: ${stepsPath}`, { section: 'SELF_HEALING' });
      return;
    }

    try {
      let content = fs.readFileSync(stepsPath, 'utf-8');

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
        fs.writeFileSync(stepsPath, content);
        logger.info(`Updated step definition for: "${stepText}"`, { section: 'SELF_HEALING' });
      } else {
        logger.warn(`Could not find step definition pattern for: "${stepText}"`, { section: 'SELF_HEALING' });
      }
    } catch (error) {
      logger.warn(`Could not update step definition for: "${stepText}"`, { section: 'SELF_HEALING', details: { error: error instanceof Error ? error.message : String(error) } });
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



