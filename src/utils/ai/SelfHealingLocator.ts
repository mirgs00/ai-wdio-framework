import { LLMClient, LLMSuggestion } from './LLMClient';
import { PageObjectModel } from './PageObjectModel';
import { browser } from '@wdio/globals';
import { getInteractableBrowserElements, getBrowserAccessibilityTree } from '@wdio/mcp/snapshot';
import type { BrowserElementInfo, AccessibilityNode } from '@wdio/mcp/snapshot';
import { logger } from '../logger';

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
            if ((await elements.length) !== 1) {
                logger.warn(`[Heal Validate] Locator is not unique. Found ${elements.length} elements.`);
                return false;
            }

            const element = elements[0];

            // 2. Check for Visibility and Interactability
            if (!(await element.isDisplayed()) || !(await element.isEnabled())) {
                logger.warn(`[Heal Validate] Locator is unique but element is not displayed or enabled.`);
                return false;
            }

            logger.info(`[Heal Validate] Locator '${locator}' is unique and visible.`);
            return true;

        } catch (error) {
            logger.error(`[Heal Validate] Validation failed for locator '${locator}'`, error);
            return false;
        }
    }

    /**
     * Gather page context using MCP snapshot for rich LLM input
     */
    private async getMCPContext(_failedLocator: string): Promise<string> {
        try {
            const elements = await getInteractableBrowserElements(browser);
            const tree = await getBrowserAccessibilityTree(browser);

            const elementsSummary = elements
                .slice(0, 30)
                .map(
                    (el: BrowserElementInfo) =>
                        `- <${el.tagName}>${el.name ? ` name="${el.name}"` : ''}${el.type ? ` type="${el.type}"` : ''} (selector: ${el.selector})${el.isInViewport ? '' : ' [outside viewport]'}`
                )
                .join('\n');

            const treeSummary = tree
                .slice(0, 15)
                .map((n: AccessibilityNode) => `- [${n.role}] "${n.name}" (selector: ${n.selector})`)
                .join('\n');

            return `**Interactable Elements (via MCP snapshot):**\n${elementsSummary}\n\n**Accessibility Tree:**\n${treeSummary}`;
        } catch (error) {
            logger.warn(`[SelfHealingLocator] MCP context gathering failed: ${error instanceof Error ? error.message : error}, using fallback`);
            return '**Page context unavailable** — unable to gather interactable elements or accessibility tree.';
        }
    }

    /**
     * Retry wrapper for MCP snapshot calls with short delay.
     */
    private async getMCPContextWithRetry(failedLocator: string, retries: number = 1): Promise<string> {
        for (let attempt = 0; attempt <= retries; attempt++) {
            const context = await this.getMCPContext(failedLocator);
            if (context && !context.includes('**Page context unavailable**')) {
                return context;
            }
            if (attempt < retries) {
                logger.info('[SelfHealingLocator] Retrying MCP context gathering...');
                await new Promise((resolve) => setTimeout(resolve, 500));
            }
        }
        return '**Page context unavailable** — unable to gather interactable elements or accessibility tree.';
    }

    /**
     * The main self-healing method, called upon an ElementNotFound error.
     * @param elementName The name of the element in the Page Object Model.
     * @param failedLocator The value of the locator that failed.
     * @returns True if healing was successful and the test step can be retried.
     */
    public async attemptHeal(elementName: string, failedLocator: string): Promise<boolean> {
        logger.info(`[HEALING START] Attempting to heal '${elementName}' (Failed: ${failedLocator})`);
        
        const locatorData = this.pom.locators[elementName];
        if (!locatorData) {
            logger.error(`[HEALING FAILED] Element '${elementName}' not found in POM. Cannot heal.`);
            return false;
        }

        // 1. Context Gathering via MCP snapshot (all interactable elements + accessibility tree)
        const pageContext = await this.getMCPContextWithRetry(failedLocator);
        
        // 2. LLM Invocation with Resilience — pass richer context
        const llmSuggestion = await this.llmClient.requestNewLocator(
            failedLocator,
            pageContext,
            locatorData.semanticPurpose
        );
        
        if (!llmSuggestion) {
            logger.error("[HEALING FAILED] LLM did not return a valid suggestion after all retries.");
            return false;
        }

        logger.info(`[LLM SUGGESTION] New Locator: ${llmSuggestion.newLocator} (${llmSuggestion.locatorType}). Reason: ${llmSuggestion.reasoning}`);

        // 3. Locator Validation
        const isValid = await this._validateLocator(llmSuggestion);
        
        if (isValid) {
            // 4. Healing and Reporting (Persistence)
            const isHealed = await this.pom.updateLocator(elementName, llmSuggestion);
            
            if (isHealed) {
                logger.info(`[HEALING SUCCESS] Locator healed. Test step can be retried.`);
                return true;
            }
        }
        
        logger.error("[HEALING FAILED] Validation failed or file persistence failed.");
        return false;
    }
}