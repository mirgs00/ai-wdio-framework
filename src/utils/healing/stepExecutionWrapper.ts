import { browser } from '@wdio/globals';
import pageContextManager from '../../page-objects/pageContextManager';
import { selfHealingService, HealingContext } from './selfHealingService';

export interface StepExecutionOptions {
  stepText: string;
  pageName?: string;
  enableHealing?: boolean;
  maxRetries?: number;
}

/**
 * Wraps step execution with self-healing capabilities
 * Catches failures, attempts to heal, and retries
 */
export async function executeStepWithHealing<T>(
  stepFn: () => Promise<T>,
  options: StepExecutionOptions
): Promise<T> {
  const {
    stepText,
    pageName = getCurrentPageName(),
    enableHealing = true,
    maxRetries = 2,
  } = options;

  let lastError: Error | null = null;
  let attemptCount = 0;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      attemptCount = attempt;
      console.log(`▶️  Executing step (attempt ${attempt + 1}/${maxRetries + 1}): "${stepText}"`);
      return await stepFn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      console.error(`❌ Step failed: ${lastError.message}`);

      // Don't try healing on last attempt
      if (attempt === maxRetries || !enableHealing) {
        break;
      }

      // Attempt to heal
      const healingContext: HealingContext = {
        stepText,
        pageName,
        errorMessage: lastError.message,
        errorType: classifyError(lastError),
        attemptCount: attempt + 1,
      };

      const healingResult = await selfHealingService.healStep(healingContext);

      if (!healingResult.healed || !healingResult.retryable) {
        console.log(`⚠️ Healing failed: ${healingResult.reason}`);
        break;
      }

      console.log(`✅ Step healed: ${healingResult.reason}`);

      if (healingResult.newSelector) {
        console.log(`   New selector: ${healingResult.newSelector}`);
      }

      if (healingResult.newImplementation) {
        console.log(`   Implementation regenerated`);
      }

      // Wait before retry
      await browser.pause(500);
    }
  }

  throw lastError || new Error(`Step failed after ${maxRetries + 1} attempts`);
}

/**
 * Get current page name from page context manager
 */
function getCurrentPageName(): string {
  try {
    const currentPage = pageContextManager.getCurrentPage();
    const pages = pageContextManager.getAllPages();

    for (const [pageName, pageObj] of Object.entries(pages)) {
      if (pageObj === currentPage) {
        return pageName;
      }
    }
  } catch (error) {
    // Ignore
  }
  return 'unknown';
}

/**
 * Classify error type to guide healing strategy
 */
function classifyError(
  error: Error
): 'selector_not_found' | 'assertion_failed' | 'action_failed' | 'unknown' {
  const message = error.message.toLowerCase();

  if (
    message.includes('not found') ||
    message.includes('no such element') ||
    message.includes('stale element') ||
    message.includes('detached from dom')
  ) {
    return 'selector_not_found';
  }

  if (
    message.includes('assertion') ||
    message.includes('expected') ||
    message.includes('to contain') ||
    message.includes('toBeDisplayed')
  ) {
    return 'assertion_failed';
  }

  if (
    message.includes('click') ||
    message.includes('setValue') ||
    message.includes('cannot perform') ||
    message.includes('not clickable')
  ) {
    return 'action_failed';
  }

  return 'unknown';
}

/**
 * Decorator for Cucumber step definitions to add healing
 * Usage:
 * @healableStep("user enters username")
 * When(/^user enters username "([^"]*)"$/, async function(username) { ... })
 */
export function healableStep(description: string) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      return executeStepWithHealing(() => originalMethod.apply(this, args), {
        stepText: description,
      });
    };

    return descriptor;
  };
}
