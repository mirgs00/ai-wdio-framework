import { $ } from '@wdio/globals';
import { logger } from '../logger';

/**
 * Waits for a selector to exist in the DOM before interacting with it
 * Provides better error messages when selectors fail
 */
export async function waitForSelector(
  selector: string,
  timeout: number = 5000,
  stepName?: string
): Promise<WebdriverIO.Element> {
  try {
    const element = $(selector);
    
    await element.waitForExist({
      timeout,
      timeoutMsg: `Selector not found: ${selector}${stepName ? ` (step: ${stepName})` : ''}`
    });

    return element;
  } catch (error) {
    logger.error(
      `Failed to find selector${stepName ? ` for step: ${stepName}` : ''}`,
      new Error(`Selector: "${selector}"\nError: ${error instanceof Error ? error.message : error}`)
    );
    throw error;
  }
}

/**
 * Safely enters text into a field with existence check
 */
export async function safeSetValue(
  selector: string,
  value: string,
  stepName?: string
): Promise<void> {
  try {
    const element = await waitForSelector(selector, 5000, stepName);
    await element.clearValue();
    await element.setValue(value);
  } catch (error) {
    logger.error(`Failed to set value in ${stepName || 'field'}`, error as Error);
    throw error;
  }
}

/**
 * Safely clicks an element with existence check
 */
export async function safeClick(
  selector: string,
  stepName?: string
): Promise<void> {
  try {
    const element = await waitForSelector(selector, 5000, stepName);
    await element.click();
  } catch (error) {
    logger.error(`Failed to click ${stepName || 'element'}`, error as Error);
    throw error;
  }
}

/**
 * Safely gets text from an element with existence check
 */
export async function safeGetText(
  selector: string,
  stepName?: string
): Promise<string> {
  try {
    const element = await waitForSelector(selector, 5000, stepName);
    return await element.getText();
  } catch (error) {
    logger.error(`Failed to get text from ${stepName || 'element'}`, error as Error);
    throw error;
  }
}

/**
 * Safely checks if element is displayed with fallback to isExisting
 */
export async function safeIsDisplayed(
  selector: string,
  stepName?: string
): Promise<boolean> {
  try {
    const element = $(selector);
    
    // First check if element exists
    const exists = await element.isExisting({ timeout: 2000 });
    if (!exists) {
      logger.warn(
        `Element does not exist${stepName ? ` (step: ${stepName})` : ''}`,
        { section: 'SELECTOR_CHECK', details: { selector, stepName } }
      );
      return false;
    }

    // Then check if displayed
    const displayed = await element.isDisplayed();
    return displayed;
  } catch (error) {
    logger.warn(
      `Error checking if element is displayed${stepName ? ` (step: ${stepName})` : ''}`,
      { section: 'SELECTOR_CHECK', details: { error: error instanceof Error ? error.message : error } }
    );
    return false;
  }
}

/**
 * Tries multiple selectors in order until one works
 * Useful for resilient element selection
 */
export async function trySelectorVariants(
  selectorVariants: string[],
  timeout: number = 5000,
  stepName?: string
): Promise<{ element: WebdriverIO.Element; selector: string }> {
  const errors: string[] = [];

  for (const selector of selectorVariants) {
    try {
      const element = await waitForSelector(selector, timeout, stepName);
      logger.info(`Found element using selector variant: ${selector}`, {
        section: 'SELECTOR_FALLBACK',
        details: { stepName, variantUsed: selector, totalVariants: selectorVariants.length }
      });
      return { element, selector };
    } catch (error) {
      errors.push(selector);
    }
  }

  const errorMsg = `None of the selector variants worked:\n${errors.map(s => `  - ${s}`).join('\n')}`;
  logger.error(
    `All selector variants failed${stepName ? ` (step: ${stepName})` : ''}`,
    new Error(errorMsg)
  );
  throw new Error(errorMsg);
}

/**
 * Validates a selector exists before using it in a step
 * Good for step implementations that need early validation
 */
export async function validateSelectorExists(
  selector: string,
  timeout: number = 3000
): Promise<boolean> {
  try {
    const element = $(selector);
    return await element.isExisting({ timeout });
  } catch {
    return false;
  }
}

/**
 * Logs selector usage for debugging
 */
export function logSelectorUsage(
  stepPattern: string,
  selector: string,
  action: 'click' | 'setValue' | 'getText' | 'check' = 'check'
): void {
  logger.debug(`[SELECTOR_USAGE] ${action.toUpperCase()} on ${selector}`, {
    section: 'SELECTOR_DEBUG',
    details: { stepPattern, selector, action }
  });
}

/**
 * Gets fallback selectors for common elements when primary selector fails
 */
export function getFallbackSelectors(elementType: string): string[] {
  const fallbacks: Record<string, string[]> = {
    submit_button: [
      'button[type="submit"]',
      'button:contains("Submit")',
      'button:contains("submit")',
      '[role="button"][type="submit"]',
      'button[data-testid*="submit"]'
    ],
    success_message: [
      '.success',
      '[class*="success"]',
      '.alert-success',
      '[role="alert"]',
      '[id*="success"]'
    ],
    error_message: [
      '.error',
      '[class*="error"]',
      '.alert-error',
      '[class*="danger"]',
      '[role="alert"]'
    ],
    input_field: [
      'input[type="text"]',
      'input',
      '[type="text"]',
      '[role="textbox"]'
    ],
    login_button: [
      'button[type="submit"]',
      'button:contains("Login")',
      'button:contains("login")',
      'button:contains("Sign In")',
      '[data-testid*="login"]'
    ]
  };

  return fallbacks[elementType] || [];
}
