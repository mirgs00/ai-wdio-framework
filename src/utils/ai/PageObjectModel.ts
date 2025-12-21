import * as fs from 'fs/promises';
import * as path from 'path';
import { LLMSuggestion } from './LLMClient'; // Assuming LLMClient is in the same directory

// Define the structure for a locator in memory
export type Locator = {
    type: string;
    value: string;
    semanticPurpose: string;
};

export type LocatorMap = {
    [elementName: string]: Locator;
};

export class PageObjectModel {
    private filePath: string;
    public locators: LocatorMap; // Public for easy access by SelfHealingLocator

    constructor(filePath: string) {
        this.filePath = filePath;
        // In a real scenario, this would parse the file to load locators.
        // For this implementation, we mock the initial state.
        this.locators = this.loadInitialLocators();
    }

    private loadInitialLocators(): LocatorMap {
        // NOTE: This is a mock. In a real scenario, you would read and parse your generatedPage.ts file.
        return {
            loginButton: {
                type: 'id',
                value: 'login-button-v1', // The locator that will break
                semanticPurpose: "The button used to submit the user's login credentials."
            },
            usernameField: {
                type: 'css',
                value: '#username',
                semanticPurpose: "The input field for the username."
            }
        };
    }

    /**
     * Updates the locator in memory and persists the change to the Page Object file.
     * @param elementName The name of the element (e.g., 'loginButton').
     * @param suggestion The validated LLM suggestion.
     * @returns A promise that resolves to true if the update and persistence were successful.
     */
    public async updateLocator(
        elementName: string,
        suggestion: LLMSuggestion
    ): Promise<boolean> {
        if (!this.locators[elementName]) {
            console.error(`[POM] Error: Element '${elementName}' not found in Page Object Model.`);
            return false;
        }

        // 1. Update in-memory model
        this.locators[elementName].type = suggestion.locatorType;
        this.locators[elementName].value = suggestion.newLocator;
        console.log(`[POM] In-memory update for '${elementName}' successful.`);

        // 2. Persist change to file
        try {
            await this._writeLocatorsToFile(elementName, suggestion);
            console.log(`[POM] *** HEALED: Locator for '${elementName}' permanently updated in file: ${this.filePath} ***`);
            return true;
        } catch (error) {
            console.error(`[POM] CRITICAL ERROR: Failed to write healed locator to file.`, error);
            return false;
        }
    }

    /**
     * Private method to perform the marker-based search and replace on the file.
     * This is the core of the persistence mechanism.
     */
    private async _writeLocatorsToFile(
        elementName: string,
        suggestion: LLMSuggestion
    ): Promise<void> {
        const fileContent = await fs.readFile(this.filePath, 'utf-8');

        // 1. Construct the new code snippet to replace the old block
        const newLocatorString = `${suggestion.locatorType}=${suggestion.newLocator}`;
        
        const newCodeSnippet = `
    // LOCATOR_START: ${elementName}
    public get ${elementName}() {
        return $('${newLocatorString}'); // Healed locator: ${suggestion.reasoning}
    }
    // LOCATOR_END: ${elementName}
`;

        // 2. Define the search pattern using the markers
        // The regex captures the entire block between the start and end markers for the specific element.
        // The 's' flag (dotall) is used to allow '.' to match newlines.
        const searchPattern = new RegExp(
            `// LOCATOR_START: ${elementName}[\\s\\S]*?// LOCATOR_END: ${elementName}`,
            's'
        );

        // 3. Perform the replacement
        const newFileContent = fileContent.replace(searchPattern, newCodeSnippet.trim());

        if (newFileContent === fileContent) {
            throw new Error(`File content was not modified. Marker for '${elementName}' not found. Check if the file is correctly marked.`);
        }

        // 4. Write the entire modified content back to the file atomically
        await fs.writeFile(this.filePath, newFileContent, 'utf-8');
    }
}
