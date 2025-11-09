import { After, Before } from '@wdio/cucumber-framework';
import { browser } from '@wdio/globals';
import { selfHealingService } from './selfHealingService';
import { autoRegenerateService } from './autoRegenerateOnFailure';
import pageContextManager from '../../page-objects/pageContextManager';
import { rerunFailedStepsService } from '../test-gen/rerunFailedSteps';

let currentStepText = '';
let healingAttempted = false;

/**
 * Setup Cucumber hooks for self-healing and automatic DOM regeneration
 * Should be called in step-definitions or main config
 */
export function setupHealingHooks() {
  Before(async function () {
    healingAttempted = false;
    selfHealingService.resetAttempts();
    autoRegenerateService.reset();
  });

  After(async function (context: any) {
    // Only proceed if step failed
    if (context.result?.status !== 'failed') {
      return;
    }

    try {
      const errorMessage = context.result?.message || 'Unknown error';
      const stepText = context.pickle?.steps?.[0]?.text || currentStepText;
      const currentPageName = getCurrentPageName();
      const currentUrl = await browser.getUrl();
      const sessionActive = await browser.getSession().catch(() => null);

      // Record failed step for rerun capability
      const featureName =
        context.pickle?.uri?.split('/').pop()?.replace('.feature', '') || 'unknown';
      const scenarioName = context.pickle?.name || 'unknown scenario';

      rerunFailedStepsService.recordFailedStep({
        feature: featureName,
        scenario: scenarioName,
        step: stepText,
        url: currentUrl,
        errorMessage,
        pageName: currentPageName,
      });

      // Skip healing if already attempted in this scenario
      if (healingAttempted) {
        return;
      }

      if (!stepText) {
        console.log('⚠️ Could not determine step text for healing');
        return;
      }

      console.log(`\n╔════════════════════════════════════════════════════════════════╗`);
      console.log(`║ 🔧 SELF-HEALING: Step Failure Detected                        ║`);
      console.log(`╠════════════════════════════════════════════════════════════════╣`);
      console.log(`║ Step: "${stepText}"`);
      console.log(`║ Page: ${currentPageName} | URL: ${currentUrl}`);
      console.log(`║ Error: ${errorMessage.substring(0, 50)}...`);
      console.log(`║ Browser Session: ${sessionActive ? '✅ ACTIVE' : '❌ CLOSED'}`);
      console.log(`╚════════════════════════════════════════════════════════════════╝`);

      // First attempt: Regenerate page object from current DOM
      if (sessionActive) {
        console.log(`\n🔄 Step 1: Re-scanning DOM from LIVE PAGE (while browser is open)...`);
        const regenerated = await autoRegenerateService.regenerateFromCurrentDOM({
          stepText,
          pageName: currentPageName,
          errorMessage,
          pageUrl: currentUrl,
        });

        if (regenerated) {
          console.log(`\n✅ Page object regenerated successfully!`);
          console.log(`⏳ **Please re-run this scenario to apply the updated page object**`);
          healingAttempted = true;
          return;
        }
      } else {
        console.log(`\n⚠️ Browser session not available - cannot perform DOM scan`);
      }

      // Fallback: Try element-level healing
      console.log(`\n🔍 Step 2: Attempting element-level healing...`);
      const healingResult = await selfHealingService.healStep({
        stepText,
        pageName: currentPageName,
        errorMessage,
        errorType: 'unknown',
        attemptCount: 1,
      });

      if (healingResult.healed) {
        console.log(`✅ Element selector healed: ${healingResult.reason}`);
        console.log(`⏳ **Please re-run this scenario to apply the fix**`);
        healingAttempted = true;
      } else {
        console.log(`\n❌ Healing failed: ${healingResult.reason}`);
        console.log(`💡 Suggestions:`);
        console.log(`   1. Check the step definition matches the current page structure`);
        console.log(`   2. Verify the element still exists on the page`);
        console.log(`   3. Try running with --no-healing flag to skip auto-healing`);
      }
    } catch (error) {
      console.error(`Healing service error: ${error instanceof Error ? error.message : error}`);
    }
  });
}

/**
 * Get current page name for healing context
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
  } catch {
    // Ignore
  }
  return 'unknown';
}

/**
 * Alternative: Manual wrapper for individual steps
 * Usage: wrap(() => originalStepFn(), "step description")
 */
export async function wrapStep<T>(
  stepFn: () => Promise<T>,
  stepDescription: string,
  options?: { maxRetries?: number; pageName?: string }
): Promise<T> {
  const maxRetries = options?.maxRetries ?? 1;
  const pageName = options?.pageName ?? getCurrentPageName();

  currentStepText = stepDescription;
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await stepFn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      if (attempt === maxRetries) {
        break;
      }

      // Try healing
      console.log(`\n🔧 Attempt ${attempt + 1}: Healing step "${stepDescription}"...`);

      const healingResult = await selfHealingService.healStep({
        stepText: stepDescription,
        pageName,
        errorMessage: lastError.message,
        errorType: 'unknown',
        attemptCount: attempt + 1,
      });

      if (!healingResult.healed || !healingResult.retryable) {
        console.log(`⚠️ Healing failed: ${healingResult.reason}`);
        break;
      }

      console.log(`✅ Healed: ${healingResult.reason}`);
      await browser.pause(300);
    }
  }

  throw lastError;
}
