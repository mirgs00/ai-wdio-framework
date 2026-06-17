import { LLMClient } from 'utils/ai/LLMClient';
import { PageObjectModel } from 'utils/ai/PageObjectModel';
import { SelfHealingLocator } from 'utils/ai/SelfHealingLocator';
import { OllamaClient } from 'utils/ai/ollamaClient';
import { browser } from '@wdio/globals';
import { logger } from '../utils/logger';

// --- 1. Initialization ---

// NOTE: You must adjust the path to your generated Page Object file here.
const PAGE_OBJECT_FILE_PATH = './src/page-objects/generatedPage.ts'; 

// Initialize Core Components
const llmClient = new LLMClient(new OllamaClient());
const pom = new PageObjectModel(PAGE_OBJECT_FILE_PATH); 
const selfHealingLocator = new SelfHealingLocator(llmClient, pom);

// Export the POM for use in test files to get the current locator
export { pom }; 

// --- 2. Custom Command Implementation ---

// Extend the WebdriverIO browser object with a new command
declare global {
    namespace WebdriverIO {
        interface Browser {
            healableFind(elementName: string): Promise<WebdriverIO.Element>;
        }
    }
}

/**
 * Custom command to find an element with self-healing capabilities.
 * @param elementName The name of the element in the Page Object Model (e.g., 'loginButton').
 * @returns The found WebdriverIO Element.
 */
browser.addCommand('healableFind', async function (elementName: string): Promise<WebdriverIO.Element> {
    const MAX_ATTEMPTS = 2; // Initial attempt + 1 retry after healing

    // Get the current locator from the Page Object Model
    const locatorData = pom.locators[elementName];
    if (!locatorData) {
        throw new Error(`Element name '${elementName}' not found in Page Object Model. Cannot attempt find.`);
    }
    
    let currentLocator = locatorData.value;

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
        try {
            const element = await browser.$(currentLocator) as unknown as WebdriverIO.Element;
            await element.waitForExist({ timeout: 5000 });
            return element;

        } catch (error: unknown) {
            // 2. Intercept Element Not Found Error
            // WebdriverIO throws a specific error when an element is not found.
            const err = error as { name?: string; message?: string };
            if (err.name === 'ElementNotFound' || err.name === 'TimeoutError') {
                if (attempt === 1) {
                    logger.warn(`[HealableFind] Element '${elementName}' failed on first attempt with locator: ${currentLocator}. Triggering self-healing...`);
                    
                    // 3. Call the Self-Healing Logic
                    const healingSuccessful = await selfHealingLocator.attemptHeal(elementName, locatorData.value);

                    if (healingSuccessful) {
                        // Healing succeeded. The POM file is updated.
                        // Update the currentLocator variable for the retry attempt.
                        const newLocatorData = pom.locators[elementName];
                        currentLocator = `${newLocatorData.type}=${newLocatorData.value}`;
                        logger.info(`[HealableFind] Healing successful. Retrying with new locator: ${currentLocator}`);
                        continue; 
                    } else {
                        // Healing failed. Break the loop and re-throw the original error.
                        logger.error(`[HealableFind] Self-healing failed. Re-throwing original error.`);
                        break;
                    }
                }
            }
            // Re-throw the error if it's not the first attempt or not a locator error
            throw error;
        }
    }
    // If the loop finishes without success (healing failed), re-throw the original error
    throw new Error(`Failed to find element '${elementName}' after self-healing attempt.`);
});

