import { browser, $ } from '@wdio/globals';
import { smartLocator, ElementDescription, LocatorStrategy } from './smartLocator';
import { logger } from '../logger';

export interface SmartElementOptions {
  waitTime?: number;
  retries?: number;
  description?: string;
  useSmartLocator?: boolean;
}

/**
 * LocatorHelper - Wrapper for WebDriverIO element operations with smart locators
 */
export class LocatorHelper {
  /**
   * Find element using smart locators
   */
  static async find(description: ElementDescription | string, options: SmartElementOptions = {}) {
    const {
      waitTime = 10000,
      retries = 3,
      description: contextDesc = 'main',
      useSmartLocator = true,
    } = options;

    if (!useSmartLocator) {
      // Fallback to string selector
      if (typeof description === 'string') {
        return $(description);
      }
      throw new Error('String selector required when smart locator disabled');
    }

    try {
      const element = await smartLocator.findElement(description, contextDesc);

      if (waitTime > 0) {
        await element.waitForDisplayed({ timeout: waitTime });
      }

      return element;
    } catch (error) {
      logger.error(`Failed to find element: ${error}`);
      throw error;
    }
  }

  /**
   * Find multiple elements
   */
  static async findAll(
    description: ElementDescription | string,
    options: SmartElementOptions = {}
  ) {
    const element = await this.find(description, options);
    return element.parentElement() || element;
  }

  /**
   * Click element using smart locators
   */
  static async click(
    description: ElementDescription | string,
    options: SmartElementOptions = {}
  ): Promise<void> {
    try {
      const element = await this.find(description, options);
      await element.click();
      logger.debug(`Clicked element: ${JSON.stringify(description)}`);
    } catch (error) {
      logger.error(`Failed to click element: ${error}`);
      throw error;
    }
  }

  /**
   * Enter text using smart locators
   */
  static async setValue(
    description: ElementDescription | string,
    value: string,
    options: SmartElementOptions = {}
  ): Promise<void> {
    try {
      const element = await this.find(description, options);
      await element.clearValue();
      await element.setValue(value);
      logger.debug(`Set value "${value}" for element: ${JSON.stringify(description)}`);
    } catch (error) {
      logger.error(`Failed to set value: ${error}`);
      throw error;
    }
  }

  /**
   * Get text from element
   */
  static async getText(
    description: ElementDescription | string,
    options: SmartElementOptions = {}
  ): Promise<string> {
    try {
      const element = await this.find(description, options);
      const text = await element.getText();
      logger.debug(`Got text from element: ${text}`);
      return text;
    } catch (error) {
      logger.error(`Failed to get text: ${error}`);
      throw error;
    }
  }

  /**
   * Check if element exists
   */
  static async exists(
    description: ElementDescription | string,
    options: SmartElementOptions = {}
  ): Promise<boolean> {
    try {
      const element = await this.find(description, { ...options, waitTime: 2000 });
      return (await element.isDisplayed()) || (await element.isExisting());
    } catch (error) {
      return false;
    }
  }

  /**
   * Wait for element
   */
  static async waitFor(
    description: ElementDescription | string,
    timeout: number = 10000,
    options: SmartElementOptions = {}
  ): Promise<void> {
    try {
      const element = await this.find(description, { ...options, waitTime: timeout });
      await element.waitForDisplayed({ timeout });
      logger.debug(`Element found and displayed: ${JSON.stringify(description)}`);
    } catch (error) {
      logger.error(`Element not found within ${timeout}ms: ${error}`);
      throw error;
    }
  }

  /**
   * Get element attribute
   */
  static async getAttribute(
    description: ElementDescription | string,
    attributeName: string,
    options: SmartElementOptions = {}
  ): Promise<string | null> {
    try {
      const element = await this.find(description, options);
      return await element.getAttribute(attributeName);
    } catch (error) {
      logger.error(`Failed to get attribute: ${error}`);
      throw error;
    }
  }

  /**
   * Check if element is visible
   */
  static async isVisible(
    description: ElementDescription | string,
    options: SmartElementOptions = {}
  ): Promise<boolean> {
    try {
      const element = await this.find(description, { ...options, waitTime: 2000 });
      return await element.isDisplayed();
    } catch (error) {
      return false;
    }
  }

  /**
   * Hover over element
   */
  static async hover(
    description: ElementDescription | string,
    options: SmartElementOptions = {}
  ): Promise<void> {
    try {
      const element = await this.find(description, options);
      await element.moveTo();
      logger.debug(`Hovered over element: ${JSON.stringify(description)}`);
    } catch (error) {
      logger.error(`Failed to hover: ${error}`);
      throw error;
    }
  }

  /**
   * Take screenshot of element
   */
  static async screenshot(
    description: ElementDescription | string,
    filename: string,
    options: SmartElementOptions = {}
  ): Promise<void> {
    try {
      const element = await this.find(description, options);
      await element.saveScreenshot(filename);
      logger.debug(`Screenshot saved: ${filename}`);
    } catch (error) {
      logger.error(`Failed to take screenshot: ${error}`);
      throw error;
    }
  }

  /**
   * Get locator statistics
   */
  static getLocatorStats() {
    return smartLocator.getStats();
  }

  /**
   * Clear locator cache
   */
  static clearLocatorCache() {
    smartLocator.clearCache();
    logger.info('Locator cache cleared');
  }

  /**
   * Perform element action with retry logic
   */
  static async withRetry<T>(
    action: () => Promise<T>,
    maxRetries: number = 3,
    delayMs: number = 500
  ): Promise<T> {
    for (let i = 0; i < maxRetries; i++) {
      try {
        return await action();
      } catch (error) {
        if (i === maxRetries - 1) {
          throw error;
        }
        await browser.pause(delayMs * (i + 1)); // Exponential backoff
        logger.debug(`Retry ${i + 1}/${maxRetries} after ${delayMs * (i + 1)}ms`);
      }
    }
    throw new Error('Max retries exceeded');
  }

  /**
   * Check element text contains value
   */
  static async textContains(
    description: ElementDescription | string,
    text: string,
    options: SmartElementOptions = {}
  ): Promise<boolean> {
    try {
      const elementText = await this.getText(description, options);
      return elementText.includes(text);
    } catch (error) {
      logger.error(`Failed to check text content: ${error}`);
      return false;
    }
  }

  /**
   * Wait for element text
   */
  static async waitForText(
    description: ElementDescription | string,
    expectedText: string,
    timeout: number = 10000,
    options: SmartElementOptions = {}
  ): Promise<void> {
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      try {
        if (await this.textContains(description, expectedText, { ...options, waitTime: 1000 })) {
          logger.debug(`Element text contains "${expectedText}"`);
          return;
        }
      } catch (e) {
        // Continue waiting
      }
      await browser.pause(500);
    }

    throw new Error(`Element text did not contain "${expectedText}" within ${timeout}ms`);
  }
}

export default LocatorHelper;
