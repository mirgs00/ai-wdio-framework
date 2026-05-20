import { LLMClient, LLMSuggestion } from './LLMClient';
import { PageObjectModel } from './PageObjectModel';
import { browser } from '@wdio/globals';

// --- 1. Intelligent Context Gathering ---

/**
 * Executes JavaScript in the browser to gather a structurally relevant DOM snippet.
 * @param failedLocator The value of the locator that failed.
 * @param semanticPurpose The semantic description of the element.
 * @returns A promise resolving to the cleaned, structural DOM context string.
 */
async function getIntelligentDomContext(
    failedLocator: string,
    semanticPurpose: string
): Promise<string> {
    // 2. Execute the script in the browser, passing values as arguments (prevents injection)
    const rawDomContext = await browser.execute(
        function (failedLocator: string, semanticPurpose: string) {
            const approxElement =
                document.querySelector(`[id="${failedLocator}"]`) ||
                document.querySelector(`[data-test-id="${failedLocator}"]`) ||
                document.querySelector('body');

            let context = '';
            let current = approxElement;
            let limit = 3;

            while (current && limit > 0) {
                context = current.outerHTML + '\n' + context;
                current = current.parentElement;
                limit--;
            }
            return context;
        },
        failedLocator,
        semanticPurpose
    );

    // 3. Attribute Filtering (Pre-processing to remove noise)
    let cleanedContext = rawDomContext as string;

    // Regex to remove common dynamic/irrelevant attributes (e.g., React/Vue hashes, session IDs)
    const dynamicAttrRegex = /((?:style|class)="[^"]*?\d{4,}[^"]*?"|data-session-id="[^"]*"|data-reactid="[^"]*")/g;
    cleanedContext = cleanedContext.replace(dynamicAttrRegex, '');

    // Further cleaning: remove excessive whitespace and newlines
    cleanedContext = cleanedContext.replace(/\s+/g, ' ').trim();

    return cleanedContext;
}

// --- 2. SelfHealingLocator Implementation ---

export class SelfHealingLocator {
    constructor(private llmClient: LLMClient, private pom: PageObjectModel) {}

    /**
     * Checks if the LLM's suggested locator is valid (unique and visible).
     * (Mitigation for LLM Hallucination and Non-Unique Locators)
     * @param suggestion The LLM's suggested locator.
     * @returns True if the locator is valid, false otherwise.
     */
    private async _validateLocator(suggestion: LLMSuggestion): Promise<boolean> {
        const locator = `${suggestion.locatorType}=${suggestion.newLocator}`;
        
        try {
            // 1. Check for Uniqueness
            const elements = await browser.$$(locator);
            if (elements.length !== 1) {
                console.warn(`[Heal Validate] Locator is not unique. Found ${elements.length} elements.`);
                return false;
            }

            const element = elements[0];

            // 2. Check for Visibility and Interactability
            if (!(await element.isDisplayed()) || !(await element.isEnabled())) {
                console.warn(`[Heal Validate] Locator is unique but element is not displayed or enabled.`);
                return false;
            }

            console.log(`[Heal Validate] Locator '${locator}' is unique and visible.`);
            return true;

        } catch (error) {
            console.error(`[Heal Validate] Validation failed for locator '${locator}':`, error);
            return false;
        }
    }

    /**
     * The main self-healing method, called upon an ElementNotFound error.
     * @param elementName The name of the element in the Page Object Model.
     * @param failedLocator The value of the locator that failed.
     * @returns True if healing was successful and the test step can be retried.
     */
    public async attemptHeal(elementName: string, failedLocator: string): Promise<boolean> {
        console.log(`\n--- [HEALING START] Attempting to heal '${elementName}' (Failed: ${failedLocator}) ---`);
        
        const locatorData = this.pom.locators[elementName];
        if (!locatorData) {
            console.error(`[HEALING FAILED] Element '${elementName}' not found in POM. Cannot heal.`);
            return false;
        }

        // 1. Context Gathering (Intelligent Strategy)
        const domContext = await getIntelligentDomContext(failedLocator, locatorData.semanticPurpose);
        
        // 2. LLM Invocation with Resilience
        const llmSuggestion = await this.llmClient.requestNewLocator(
            failedLocator,
            domContext,
            locatorData.semanticPurpose
        );
        
        if (!llmSuggestion) {
            console.error("[HEALING FAILED] LLM did not return a valid suggestion after all retries.");
            return false;
        }

        console.log(`[LLM SUGGESTION] New Locator: ${llmSuggestion.newLocator} (${llmSuggestion.locatorType}). Reason: ${llmSuggestion.reasoning}`);

        // 3. Locator Validation
        const isValid = await this._validateLocator(llmSuggestion);
        
        if (isValid) {
            // 4. Healing and Reporting (Persistence)
            const isHealed = await this.pom.updateLocator(elementName, llmSuggestion);
            
            if (isHealed) {
                console.log(`\n*** [HEALING SUCCESS] Locator healed. Test step can be retried. ***`);
                return true;
            }
        }
        
        console.error("[HEALING FAILED] Validation failed or file persistence failed.");
        return false;
    }
}