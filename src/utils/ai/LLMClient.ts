import { z } from 'zod';
import * as crypto from 'crypto';
import type { LLMProvider } from './types';
import { logger } from '../logger';

// --- 1. Custom Error and Schema ---

export class LLMAPIError extends Error {
    constructor(message: string, public status?: number) {
        super(message);
        this.name = 'LLMAPIError';
    }
}

// Define the expected structured output from the LLM
export const LLMSuggestionSchema = z.object({
    newLocator: z.string().min(1),
    locatorType: z.enum(['css', 'xpath', 'id', 'name']),
    reasoning: z.string().min(1),
});

export type LLMSuggestion = z.infer<typeof LLMSuggestionSchema>;

// --- 2. LLM Client Implementation ---

export class LLMClient {
    private provider: LLMProvider;
    private modelName: string;
    private maxRetries: number;
    private timeout: number;

    constructor(
        provider: LLMProvider,
        maxRetries: number = 3,
        timeout: number = 60
    ) {
        this.provider = provider;
        this.modelName = provider.getModel();
        this.maxRetries = maxRetries;
        this.timeout = timeout;
    }

    private _buildHealingPrompt(failedLocator: string, domSnippet: string, semanticPurpose: string): string {
        // The structured prompt for the LLM
        return `
You are an expert Test Automation Engineer. Your task is to find a new, stable locator
for a web element that has changed.

**Original Element Context:**
- **Original Locator:** ${failedLocator}
- **Semantic Purpose:** ${semanticPurpose}

**Current DOM Snippet (Surrounding Context):**
${domSnippet}

**INSTRUCTION:**
Analyze the DOM snippet and the element's context. Propose a single, robust, and stable
locator that uniquely identifies the element. The locator must be a valid WebDriver selector.
Do not include any text or explanation outside of the JSON object.

**RESPONSE FORMAT (JSON ONLY):**
${JSON.stringify({ newLocator: "#login-btn", locatorType: "css", reasoning: "Most stable unique selector" }, null, 2)}
`;
    }

    private async _callLLM(prompt: string): Promise<string> {
        return this.provider.generateText(prompt, {
            temperature: 0.1,
            max_tokens: 300,
        });
    }

    public async requestNewLocator(
        failedLocator: string,
        domSnippet: string,
        semanticPurpose: string
    ): Promise<LLMSuggestion | null> {
        const prompt = this._buildHealingPrompt(failedLocator, domSnippet, semanticPurpose);

        for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
            logger.info(`[LLMClient] Attempting to get new locator (Attempt ${attempt}/${this.maxRetries})...`);
            try {
                const rawJson = await this._callLLM(prompt);

                if (!rawJson) {
                    throw new LLMAPIError('LLM returned an empty response.');
                }

                // 2. JSON Schema Validation (Mitigation for Malformed Response)
                const parsedJson = JSON.parse(rawJson);
                const validatedSuggestion = LLMSuggestionSchema.parse(parsedJson);

                logger.info(`[LLMClient] Success on attempt ${attempt}.`);
                return validatedSuggestion;

            } catch (error) {
                logger.error(`[LLMClient] Error on attempt ${attempt}: ${error instanceof Error ? error.message : String(error)}`);

                if (attempt < this.maxRetries) {
                    // Exponential Backoff with Jitter (Mitigation for API Failure/Timeout)
                    const baseDelay = 2 ** attempt;
                    const jitter = crypto.randomInt(0, 1000) / 1000; // 0 to 1 second jitter
                    const waitTime = baseDelay + jitter;
                    logger.info(`[LLMClient] Retrying in ${waitTime.toFixed(2)} seconds...`);
                    await new Promise(resolve => setTimeout(resolve, waitTime * 1000));
                } else {
                    logger.error('[LLMClient] All retry attempts exhausted. Healing failed at LLM stage.');
                    return null;
                }
            }
        }
        return null;
    }
}