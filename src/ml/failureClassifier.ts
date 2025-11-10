import { createOllamaClient } from '../utils/ai/ollamaClient';

interface RecoveryPlan {
    canRecover: boolean;
    strategy?: 'updateSelector' | 'retryWithWait' | 'reloadPage' | 'none';
    details?: {
        oldSelector?: string;
        newSelector?: string;
        waitTime?: number;
    };
    reasoning?: string;
}

export class MLFailureClassifier {
    private ollamaClient = createOllamaClient();

    async classifyFailure(error: Error): Promise<RecoveryPlan> {
        console.log('[Classifier] Analyzing failure:', error.message);

        const prompt = `
            Analyze the following WebdriverIO test failure and determine a recovery strategy.
            
            Error:
            \`\`\`
            ${error.stack || error.message}
            \`\`\`

            Possible failure types are:
            1.  **StaleElement**: The selector is no longer valid (e.g., ID changed).
            2.  **TimingIssue**: The element was not ready; a wait or pause is needed.
            3.  **PageLoadError**: The page did not load correctly.
            4.  **AssertionError**: The test assertion failed.
            5.  **UnknownError**: The error is not recognizable.

            Based on the error, provide a JSON response with the following structure:
            {
                "canRecover": boolean, // true if this is a StaleElement, TimingIssue, or PageLoadError
                "strategy": "updateSelector" | "retryWithWait" | "reloadPage" | "none",
                "details": { 
                    "oldSelector": "the selector that failed (if applicable)",
                    "newSelector": "a suggested new selector (if strategy is updateSelector)",
                    "waitTime": "suggested wait time in ms (if strategy is retryWithWait)"
                },
                "reasoning": "A brief explanation of why you chose this strategy."
            }

            Example for a stale selector:
            If error is "Error: Element with selector \\"#old_id\\" not found", respond with:
            {
                "canRecover": true,
                "strategy": "updateSelector",
                "details": { "oldSelector": "#old_id", "newSelector": "#new_id" },
                "reasoning": "The selector #old_id is likely stale. A new selector should be found."
            }

            Now, analyze the provided error and respond only with the JSON object.
        `;

        try {
            const response = await this.ollamaClient.generateText(prompt, { temperature: 0.1 });
            const parsedResponse = this.parseAIResponse(response);
            console.log('[Classifier] AI analysis complete:', parsedResponse);
            return parsedResponse;
        } catch (aiError) {
            console.error('[Classifier] AI analysis failed:', aiError);
            return {
                canRecover: false,
                strategy: 'none',
                reasoning: 'AI analysis failed, cannot determine recovery strategy.',
            };
        }
    }

    private parseAIResponse(response: string): RecoveryPlan {
        try {
            // The AI might return the JSON inside a code block, so we need to extract it.
            const jsonMatch = response.match(/```json\n([\s\S]*?)\n```|({[\s\S]*})/);
            if (!jsonMatch) {
                throw new Error('No JSON object found in the AI response.');
            }
            // Prioritize the first capture group (code block) if it exists, otherwise use the second (raw object).
            const jsonString = jsonMatch[1] || jsonMatch[2];
            return JSON.parse(jsonString) as RecoveryPlan;
        } catch (e) {
            console.error('Error parsing AI response:', e);
            console.error('Raw response was:', response);
            throw new Error('Failed to parse recovery plan from AI response.');
        }
    }
}
