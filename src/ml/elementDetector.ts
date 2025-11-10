import { getDOMSnapshot } from '../utils/dom/domParser';
import { analyzeDOM, PageAnalysis } from '../utils/dom/domAnalyzer';
import { createOllamaClient } from '../utils/ai/ollamaClient';

export interface DetectedElement {
    name: string;
    selector: string;
    reasoning: string;
}

export class MLElementDetector {
    private ollamaClient = createOllamaClient();

    async detectPageObjects(url: string): Promise<PageAnalysis> {
        console.log(`[ML] Starting element detection for: ${url}`);

        // 1. Fetch DOM
        const dom = await getDOMSnapshot(url);

        // 2. Analyze DOM structure
        const analysis = analyzeDOM(dom);
        console.log('[ML] DOM analysis complete.');

        // TODO: Implement the AI semantic detection part
        // For now, we will just return the basic analysis.
        // The next step will be to use `ollamaClient` to enhance this analysis.

        return analysis;
    }

    private async aiSemanticDetection(analysis: PageAnalysis): Promise<DetectedElement[]> {
        const prompt = `
            Based on the following DOM analysis of a web page, identify the key UI elements and suggest robust CSS selectors.
            Focus on elements critical for user interaction (login forms, search bars, main action buttons).
            For each element, provide a name, a suggested selector, and a brief reasoning.

            DOM Analysis:
            ${JSON.stringify(analysis, null, 2)}

            Return a JSON array of objects with the format: { "name": "elementName", "selector": "cssSelector", "reasoning": "why this is important" }
        `;

        const response = await this.ollamaClient.generateText(prompt);
        
        try {
            // TODO: Add robust parsing and validation
            return JSON.parse(response);
        } catch (error) {
            console.error('[ML] Failed to parse AI response:', error);
            return [];
        }
    }
}
