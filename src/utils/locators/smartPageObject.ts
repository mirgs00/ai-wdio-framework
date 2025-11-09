import { browser } from '@wdio/globals';
import { LocatorHelper, SmartElementOptions } from './locatorHelper';
import { ElementDescription } from './smartLocator';
import { logger } from '../logger';

/**
 * SmartPageObject - Base class for page objects with smart locators
 * Provides intelligent element finding, caching, and learning capabilities
 */
export abstract class SmartPageObject {
  protected pageTitle?: string;
  protected pageUrl?: string;
  protected elementsCache: Map<string, ElementDescription> = new Map();

  constructor(title?: string, url?: string) {
    this.pageTitle = title;
    this.pageUrl = url;
  }

  /**
   * Open page
   */
  async open(): Promise<void> {
    if (!this.pageUrl) {
      throw new Error('Page URL not configured');
    }
    await browser.url(this.pageUrl);
    await this.waitForPageLoad();
    logger.info(`Opened page: ${this.pageTitle || this.pageUrl}`);
  }

  /**
   * Wait for page to load
   */
  async waitForPageLoad(): Promise<void> {
    await browser.waitUntil(
      async () => (await browser.execute(() => document.readyState)) === 'complete',
      { timeout: 15000, timeoutMsg: 'Page did not load' }
    );
  }

  /**
   * Find element with smart locators
   */
  protected async findSmartElement(
    description: ElementDescription | string,
    options?: SmartElementOptions
  ) {
    return LocatorHelper.find(description, options);
  }

  /**
   * Register element in cache for reuse
   */
  protected registerElement(key: string, description: ElementDescription): void {
    this.elementsCache.set(key, description);
  }

  /**
   * Get registered element
   */
  protected getRegisteredElement(key: string): ElementDescription | undefined {
    return this.elementsCache.get(key);
  }

  /**
   * Click element with smart locators
   */
  protected async smartClick(
    description: ElementDescription | string,
    options?: SmartElementOptions
  ): Promise<void> {
    await LocatorHelper.click(description, options);
  }

  /**
   * Enter text with smart locators
   */
  protected async smartSetValue(
    description: ElementDescription | string,
    value: string,
    options?: SmartElementOptions
  ): Promise<void> {
    await LocatorHelper.setValue(description, value, options);
  }

  /**
   * Get text with smart locators
   */
  protected async smartGetText(
    description: ElementDescription | string,
    options?: SmartElementOptions
  ): Promise<string> {
    return LocatorHelper.getText(description, options);
  }

  /**
   * Check if element exists
   */
  protected async smartExists(
    description: ElementDescription | string,
    options?: SmartElementOptions
  ): Promise<boolean> {
    return LocatorHelper.exists(description, options);
  }

  /**
   * Wait for element
   */
  protected async smartWaitFor(
    description: ElementDescription | string,
    timeout?: number,
    options?: SmartElementOptions
  ): Promise<void> {
    await LocatorHelper.waitFor(description, timeout, options);
  }

  /**
   * Get element attribute
   */
  protected async smartGetAttribute(
    description: ElementDescription | string,
    attributeName: string,
    options?: SmartElementOptions
  ): Promise<string | null> {
    return LocatorHelper.getAttribute(description, attributeName, options);
  }

  /**
   * Check if element is visible
   */
  protected async smartIsVisible(
    description: ElementDescription | string,
    options?: SmartElementOptions
  ): Promise<boolean> {
    return LocatorHelper.isVisible(description, options);
  }

  /**
   * Hover over element
   */
  protected async smartHover(
    description: ElementDescription | string,
    options?: SmartElementOptions
  ): Promise<void> {
    await LocatorHelper.hover(description, options);
  }

  /**
   * Wait for text content
   */
  protected async smartWaitForText(
    description: ElementDescription | string,
    expectedText: string,
    timeout?: number,
    options?: SmartElementOptions
  ): Promise<void> {
    await LocatorHelper.waitForText(description, expectedText, timeout, options);
  }

  /**
   * Check if element text contains value
   */
  protected async smartTextContains(
    description: ElementDescription | string,
    text: string,
    options?: SmartElementOptions
  ): Promise<boolean> {
    return LocatorHelper.textContains(description, text, options);
  }

  /**
   * Perform action with retry logic
   */
  protected async smartWithRetry<T>(
    action: () => Promise<T>,
    maxRetries?: number,
    delayMs?: number
  ): Promise<T> {
    return LocatorHelper.withRetry(action, maxRetries, delayMs);
  }

  /**
   * Fill form field with smart locators
   */
  async fillField(description: ElementDescription | string, value: string): Promise<void> {
    await LocatorHelper.waitFor(description);
    await LocatorHelper.setValue(description, value);
  }

  /**
   * Fill multiple fields
   */
  async fillForm(
    fields: Array<{ description: ElementDescription | string; value: string }>
  ): Promise<void> {
    for (const field of fields) {
      await this.fillField(field.description, field.value);
    }
  }

  /**
   * Get form data
   */
  async getFormData(
    descriptions: Array<ElementDescription | string>
  ): Promise<{ [key: string]: string }> {
    const data: { [key: string]: string } = {};

    for (let i = 0; i < descriptions.length; i++) {
      const desc = descriptions[i];
      const key = typeof desc === 'string' ? desc : desc.text || `field_${i}`;
      data[key] = await LocatorHelper.getText(desc);
    }

    return data;
  }

  /**
   * Clear cache and reload page
   */
  async refresh(): Promise<void> {
    LocatorHelper.clearLocatorCache();
    await browser.refresh();
    await this.waitForPageLoad();
  }

  /**
   * Get locator statistics
   */
  getLocatorStats() {
    return LocatorHelper.getLocatorStats();
  }

  /**
   * Verify element visibility
   */
  async verifyElementVisible(
    description: ElementDescription | string,
    timeout: number = 5000
  ): Promise<boolean> {
    try {
      await LocatorHelper.waitFor(description, timeout);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Verify element not visible
   */
  async verifyElementNotVisible(
    description: ElementDescription | string,
    timeout: number = 5000
  ): Promise<boolean> {
    try {
      await LocatorHelper.waitFor(description, 1000);
      return false;
    } catch {
      return true;
    }
  }

  /**
   * Verify text in element
   */
  async verifyText(
    description: ElementDescription | string,
    expectedText: string
  ): Promise<boolean> {
    try {
      const text = await LocatorHelper.getText(description);
      return text.includes(expectedText);
    } catch {
      return false;
    }
  }

  /**
   * Perform action and verify element state
   */
  async actionAndVerify(
    action: () => Promise<void>,
    verification: () => Promise<boolean>,
    maxRetries: number = 3
  ): Promise<boolean> {
    for (let i = 0; i < maxRetries; i++) {
      try {
        await action();
        if (await verification()) {
          return true;
        }
      } catch (e) {
        logger.debug(`Action verification attempt ${i + 1} failed: ${e}`);
      }
      await browser.pause(500 * (i + 1));
    }
    return false;
  }
}

export default SmartPageObject;
