import { createOllamaClient } from '../utils/ai/ollamaClient';
import { PageAnalysis } from '../utils/dom/domAnalyzer';

export interface TestCase {
    id: string;
    description: string;
    steps: string[];
    type: 'happyPath' | 'negative' | 'edgeCase';
}

export class AdaptiveTestGenerator {
    private ollamaClient = createOllamaClient();

    async generateContextAwareTests(analysis: PageAnalysis): Promise<TestCase[]> {
        console.log('[Generator] Generating context-aware tests based on page analysis...');

        const prompt = `
            You are an expert QA engineer. Based on the following DOM analysis of a web page, generate a comprehensive suite of test cases.
            The test cases should cover happy paths, negative scenarios, and edge cases.

            DOM Analysis:
            \`\`\`json
            ${JSON.stringify({
                title: analysis.title,
                mainFunctionality: analysis.mainFunctionality,
                forms: analysis.forms.map(f => ({
                    fields: f.fields.map(field => ({ name: field.name, type: field.type, required: field.required })),
                    submit_button: f.submit_button,
                })),
                buttons: analysis.buttons,
                links: analysis.links.length,
            }, null, 2)}
            \`\`\`

            Generate a JSON array of test case objects. Each object must have the following structure:
            {
                "id": "a-unique-id-for-the-test",
                "description": "A brief description of the test case.",
                "steps": [
                    "A sequence of user actions in plain English.",
                    "For example: 'Enter a valid username in the username field.'",
                    "Then: 'Verify that the success message is displayed.'"
                ],
                "type": "'happyPath' | 'negative' | 'edgeCase'"
            }

            Focus on the main functionality: **${analysis.mainFunctionality}**.

            Example Response:
            \`\`\`json
            [
                {
                    "id": "login-success",
                    "description": "Test successful login with valid credentials.",
                    "steps": [
                        "Enter a valid username.",
                        "Enter a valid password.",
                        "Click the submit button.",
                        "Verify the user is redirected to the dashboard."
                    ],
                    "type": "happyPath"
                },
                {
                    "id": "login-invalid-password",
                    "description": "Test login with an invalid password.",
                    "steps": [
                        "Enter a valid username.",
                        "Enter an invalid password.",
                        "Click the submit button.",
                        "Verify the error message is displayed."
                    ],
                    "type": "negative"
                }
            ]
            \`\`\`

            Now, generate the test cases for the provided DOM analysis. Respond only with the JSON array.
        `;

        try {
            const response = await this.ollamaClient.generateText(prompt, { temperature: 0.2, max_tokens: 2048 });
            const testCases = this.parseAIResponse(response);
            console.log(`[Generator] Successfully generated ${testCases.length} test cases.`);
            return testCases;
        } catch (aiError) {
            console.error('[Generator] Failed to generate tests:', aiError);
            return [];
        }
    }

    private parseAIResponse(response: string): TestCase[] {
        try {
            const jsonMatch = response.match(/```json\n([\s\S]*?)\n```|(\[[\s\S]*\])/);
            if (!jsonMatch) {
                throw new Error('No JSON array found in the AI response.');
            }
            const jsonString = jsonMatch[1] || jsonMatch[2];
            return JSON.parse(jsonString) as TestCase[];
        } catch (e) {
            console.error('Error parsing AI response for test cases:', e);
            console.error('Raw response was:', response);
            throw new Error('Failed to parse test cases from AI response.');
        }
    }
}
