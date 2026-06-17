import { browser } from '@wdio/globals';
import { writeFileSync } from 'fs';
import * as path from 'path';
import type { BrowserElementInfo, AccessibilityNode } from '@wdio/mcp/snapshot';
import { HEALING_CONFIG } from '../constants';
import { logger } from '../logger';

// Dynamic import for ESM-only @wdio/mcp/snapshot
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let mcpSnapshot: any = null;
async function loadMCPSnapshot(): Promise<boolean> {
  if (mcpSnapshot) return true;
  try {
    mcpSnapshot = await import('@wdio/mcp/snapshot');
    return true;
  } catch {
    return false;
  }
}

export interface RegenerationContext {
  stepText: string;
  pageName: string;
  errorMessage: string;
  pageUrl: string;
}

class AutoRegenerateService {
  private maxRegenerationAttempts = HEALING_CONFIG.MAX_REGENERATION_ATTEMPTS;
  private regeneratedPages = new Set<string>();

  /**
   * Attempt to regenerate page objects from current DOM on failure
   * This is triggered by the healing hooks when a step fails
   */
  async regenerateFromCurrentDOM(context: RegenerationContext): Promise<boolean> {
    const cacheKey = context.pageName;

    if (this.regeneratedPages.has(cacheKey)) {
      logger.info(`Already regenerated ${context.pageName} in this scenario`, { section: 'AUTO_REGENERATE' });
      return false;
    }

    logger.info(`Auto-regenerating ${context.pageName} page object from MCP snapshot`, { section: 'AUTO_REGENERATE' });

    try {
      // Get current page elements via MCP snapshot (in-browser detection)
      const loaded = await loadMCPSnapshot();
      if (!loaded || !mcpSnapshot) {
        logger.warn('MCP snapshot not available for regeneration', { section: 'AUTO_REGENERATE' });
        return false;
      }
      const elements = await mcpSnapshot.getInteractableBrowserElements(browser);
      const accessibilityTree = await mcpSnapshot.getBrowserAccessibilityTree(browser);

      if (elements.length === 0) {
        logger.warn('No interactable elements found on page', { section: 'AUTO_REGENERATE' });
        return false;
      }

      logger.info(`Found ${elements.length} interactable elements on ${context.pageName}`, {
        section: 'AUTO_REGENERATE',
        details: {
          inputs: elements.filter((e: BrowserElementInfo) => e.tagName === 'input' || e.tagName === 'select' || e.tagName === 'textarea').length,
          buttons: elements.filter((e: BrowserElementInfo) => e.tagName === 'button' || (e.tagName === 'input' && e.type === 'submit')).length,
          links: elements.filter((e: BrowserElementInfo) => e.tagName === 'a').length,
          treeNodes: accessibilityTree.length,
        },
      });

      // Update the page object file
      const success = await this.updatePageObjectFromAnalysis(
        context.pageName,
        elements,
        accessibilityTree,
        context.pageUrl
      );

      if (success) {
        this.regeneratedPages.add(cacheKey);
        logger.info(`Successfully regenerated ${context.pageName} page object`, { section: 'AUTO_REGENERATE' });
        return true;
      }

      return false;
    } catch (error) {
      logger.error('Regeneration failed', error as Error);
      return false;
    }
  }

  /**
   * Detect page type from MCP element data (accessible names + tagNames)
   */
  private detectPageTypeFromElements(elements: BrowserElementInfo[], tree: AccessibilityNode[]): string {
    const names = elements.map((e) => e.name?.toLowerCase()).filter(Boolean) as string[];
    const treeNames = tree.map((n) => n.name?.toLowerCase()).filter(Boolean) as string[];
    const allText = [...names, ...treeNames].join(' ');

    if (allText.includes('logged in') || allText.includes('logged-in') || allText.includes('dashboard')) {
      return 'dashboard';
    }
    if (allText.includes('error') && !allText.includes('password')) {
      return 'error';
    }
    return 'login';
  }

  /**
   * Update page object file based on MCP snapshot data
   */
  private async updatePageObjectFromAnalysis(
    pageName: string,
    elements: BrowserElementInfo[],
    accessibilityTree: AccessibilityNode[],
    pageUrl: string
  ): Promise<boolean> {
    try {
      const detectedPageType = this.detectPageTypeFromElements(elements, accessibilityTree);
      const finalPageName = pageName || detectedPageType;
      const pageObjectPath = path.resolve(
        `src/page-objects/generated${this.capitalize(finalPageName)}Page.ts`
      );

      logger.info('DOM Analysis Complete (MCP snapshot)', {
        section: 'AUTO_REGENERATE',
        details: {
          pageType: finalPageName,
          inputs: elements.filter((e: BrowserElementInfo) => e.tagName === 'input' || e.tagName === 'select' || e.tagName === 'textarea').length,
          buttons: elements.filter((e: BrowserElementInfo) => e.tagName === 'button' || (e.tagName === 'input' && e.type === 'submit')).length,
          links: elements.filter((e: BrowserElementInfo) => e.tagName === 'a').length,
          treeNodes: accessibilityTree.length,
        },
      });

      // Generate page object code with MCP-detected elements
      const pageObjectCode = this.generatePageObjectCode(finalPageName, elements, accessibilityTree, pageUrl);

      writeFileSync(pageObjectPath, pageObjectCode, 'utf-8');
      logger.info(`Updated: ${pageObjectPath}`);

      return true;
    } catch (error) {
      logger.warn(
        `Could not update page object: ${error instanceof Error ? error.message : error}`
      );
      return false;
    }
  }

  /**
   * Generate complete page object code from MCP snapshot data
   */
  private generatePageObjectCode(pageName: string, elements: BrowserElementInfo[], tree: AccessibilityNode[], pageUrl: string): string {
    const className = this.capitalize(pageName) + 'Page';

    const elementGetters: string[] = [];

    // Input fields from MCP interactable elements
    const inputs = elements.filter((e) => e.tagName === 'input' || e.tagName === 'select' || e.tagName === 'textarea');
    inputs.forEach((el, idx) => {
      const varName = (el.name || el.type || `input${idx}`).replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
      elementGetters.push(`
  get ${this.toCamelCase(varName + '_input')}() {
    return $('${el.selector.replace(/'/g, "\\'")}');
  }`);
    });

    // Buttons from MCP interactable elements
    const buttons = elements.filter((e) => e.tagName === 'button' || (e.tagName === 'input' && e.type === 'submit'));
    buttons.forEach((el, idx) => {
      const varName = (el.name || `button${idx}`).replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
      elementGetters.push(`
  get ${this.toCamelCase(varName + '_button')}() {
    return $('${el.selector.replace(/'/g, "\\'")}');
  }`);
    });

    // Links from MCP interactable elements
    const links = elements.filter((e) => e.tagName === 'a' && e.href);
    links.forEach((el, idx) => {
      const varName = (el.name || `link${idx}`).replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
      elementGetters.push(`
  get ${this.toCamelCase(varName + '_link')}() {
    return $('${el.selector.replace(/'/g, "\\'")}');
  }`);
    });

    // Headings from MCP accessibility tree
    const headings = tree.filter((n) => n.role === 'heading');
    headings.forEach((n, idx) => {
      const varName = (n.name || `heading${idx}`).replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
      elementGetters.push(`
  get ${this.toCamelCase(varName + '_heading')}() {
    return $('${n.selector.replace(/'/g, "\\'")}');
  }`);
    });

    // Alert/error/success elements from accessibility tree
    const alerts = tree.filter((n) => n.role === 'alert');
    alerts.forEach((n, idx) => {
      const varName = (n.name || `alert${idx}`).replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
      elementGetters.push(`
  get ${this.toCamelCase(varName + '_alert')}() {
    return $('${n.selector.replace(/'/g, "\\'")}');
  }`);
    });

    // Remaining interactable elements as generic getters (max 10 to avoid bloat)
    const used = new Set([...inputs, ...buttons, ...links].map((e) => e.selector));
    const remaining = elements.filter((e) => !used.has(e.selector)).slice(0, 10);
    remaining.forEach((el, idx) => {
      const varName = (el.name || el.tagName || `element${idx}`).replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
      elementGetters.push(`
  get ${this.toCamelCase(varName + '_element')}() {
    return $('${el.selector.replace(/'/g, "\\'")}');
  }`);
    });

    return `// Auto-generated Page Object for ${pageName} page
// Regenerated: ${new Date().toISOString()}
// Auto-healing enabled: MCP snapshot re-scanned
import { $, browser } from '@wdio/globals';

class ${className} {
${elementGetters.join('')}

  async open() {
    await browser.url('${pageUrl.replace(/'/g, "\\'")}');
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
  }

  private toCamelCase(str: string): string {
    return str
      .replace(/(?:^\w|[A-Z]|\b\w|\s+)/g, (match, index) => {
        if (+match === 0) return '';
        return index === 0 ? match.toLowerCase() : match.toUpperCase();
      })
      .replace(/[^\w]/gi, '');
  }

  private capitalize(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  /**
   * Reset regeneration cache (per scenario)
   */
  reset(): void {
    this.regeneratedPages.clear();
  }
}

export const autoRegenerateService = new AutoRegenerateService();
