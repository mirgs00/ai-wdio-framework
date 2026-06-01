import * as fs from 'fs/promises';
import * as fsSync from 'fs';
import { LLMSuggestion } from './LLMClient';
import { logger } from '../logger';

export type Locator = {
    type: string;
    value: string;
    semanticPurpose: string;
};

export type LocatorMap = {
    [elementName: string]: Locator;
};

function inferLocatorType(selector: string): string {
    if (selector.startsWith('#')) return 'id'
    if (selector.startsWith('.')) return 'css'
    if (selector.startsWith('/') || selector.startsWith('(')) return 'xpath'
    if (selector.startsWith('[')) return 'css'
    return 'css'
}

function getterNameToPurpose(name: string): string {
    return name
        .replace(/([A-Z])/g, ' $1')
        .replace(/[_-]/g, ' ')
        .trim()
        .toLowerCase()
}

export class PageObjectModel {
    private filePath: string;
    public locators: LocatorMap;

    constructor(filePath: string) {
        this.filePath = filePath;
        this.locators = this.parsePageObjectFile();
        if (Object.keys(this.locators).length === 0) {
            logger.warn(`[POM] No locators found in ${filePath}, using empty map`);
        }
    }

    private parsePageObjectFile(): LocatorMap {
        const locators: LocatorMap = {}

        let content: string
        try {
            content = fsSync.readFileSync(this.filePath, 'utf-8')
        } catch {
            logger.warn(`[POM] Could not read file: ${this.filePath}`)
            return locators
        }

        const getterRegex = /(?:public\s+)?get\s+(\w+)\s*\(\s*\)[^{]*\{\s*return\s+\$\(['"`]([^'"`]+)['"`]\)/g
        let match: RegExpExecArray | null
        while ((match = getterRegex.exec(content)) !== null) {
            const name = match[1]
            const value = match[2]
            locators[name] = {
                type: inferLocatorType(value),
                value,
                semanticPurpose: getterNameToPurpose(name),
            }
        }

        // If file uses LOCATOR_START/LOCATOR_END markers, also parse those
        const markerRegex = /\/\/ LOCATOR_START:\s*(\w+)[\s\S]*?return\s+\$\(['"`]([^'"`]+)['"`]\)/g
        while ((match = markerRegex.exec(content)) !== null) {
            const name = match[1]
            const value = match[2]
            if (!locators[name]) {
                locators[name] = {
                    type: inferLocatorType(value),
                    value,
                    semanticPurpose: getterNameToPurpose(name),
                }
            }
        }

        return locators
    }

    public async updateLocator(
        elementName: string,
        suggestion: LLMSuggestion
    ): Promise<boolean> {
        if (!this.locators[elementName]) {
            logger.error(`[POM] Error: Element '${elementName}' not found in Page Object Model.`);
            return false;
        }

        this.locators[elementName].type = suggestion.locatorType;
        this.locators[elementName].value = suggestion.newLocator;
        logger.info(`[POM] In-memory update for '${elementName}' successful.`);

        try {
            await this._writeLocatorsToFile(elementName, suggestion);
            logger.info(`[POM] Healed locator for '${elementName}' persisted to file: ${this.filePath}`);
            return true;
        } catch (error) {
            logger.error(`[POM] Failed to write healed locator to file`, error as Error);
            return false;
        }
    }

    private async _writeLocatorsToFile(
        elementName: string,
        suggestion: LLMSuggestion
    ): Promise<void> {
        const fileContent = await fs.readFile(this.filePath, 'utf-8');
        const newLocatorValue = suggestion.newLocator;

        // Try marker-based replacement first
        const escaped = elementName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const markerPattern = new RegExp(
            `// LOCATOR_START: ${escaped}[\\s\\S]*?// LOCATOR_END: ${escaped}`,
            's'
        );
        const markerCode = `
    // LOCATOR_START: ${elementName}
    public get ${elementName}() {
        return $('${newLocatorValue}');
    }
    // LOCATOR_END: ${elementName}
`;

        let newContent = fileContent.replace(markerPattern, markerCode.trim());

        if (newContent === fileContent) {
            // Fall back to regex replacement (no markers in file)
            const getterRegex = new RegExp(
                `(get\\s+${escaped}\\s*\\(\\s*\\)\\s*{\\s*return\\s+\\$\\()['"\`]([^'"\`]+)['"\`]`,
                'g'
            );
            newContent = fileContent.replace(getterRegex, `$1'${newLocatorValue}'`);

            if (newContent === fileContent) {
                throw new Error(`Could not find getter '${elementName}' in ${this.filePath}`);
            }
        }

        await fs.writeFile(this.filePath, newContent, 'utf-8');
    }
}
